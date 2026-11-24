import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { checkoutBody, Client, freshDb, uuid } from "./helpers";
import * as products from "@/app/api/v1/products/route";
import * as product from "@/app/api/v1/products/[slug]/route";
import * as categories from "@/app/api/v1/categories/route";
import * as suggest from "@/app/api/v1/search/suggest/route";
import * as cart from "@/app/api/v1/cart/route";
import * as cartItems from "@/app/api/v1/cart/items/route";
import * as cartItem from "@/app/api/v1/cart/items/[variantId]/route";
import * as promo from "@/app/api/v1/cart/promo/route";
import * as orders from "@/app/api/v1/orders/route";
import * as register from "@/app/api/v1/auth/register/route";
import * as login from "@/app/api/v1/auth/login/route";
import * as session from "@/app/api/v1/auth/session/route";
import { inventoryMovements, productVariants, promotions } from "@/server/db/schema";
import type { Db } from "@/server/db/client";
import type { ProductDTO } from "@/lib/api-types";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await freshDb()));
afterAll(() => close());

async function getProduct(slug: string): Promise<ProductDTO> {
  return (await new Client().call(product.GET, "GET", `/api/v1/products/${slug}`, { params: { slug } })).data.product;
}
const stockOf = async (variantId: string) =>
  (await db.select({ s: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId)))[0].s;

describe("catalogue", () => {
  it("lists active products with localized fields and pagination metadata", async () => {
    const r = await new Client().call(products.GET, "GET", "/api/v1/products", { query: { pageSize: "5" } });
    expect(r.status).toBe(200);
    expect(r.data.total).toBe(12);
    expect(r.data.items).toHaveLength(5);
    const p = r.data.items[0] as ProductDTO;
    expect(p.short.fr).toBeTruthy();
    expect(p.short.ar).toMatch(/[؀-ۿ]/);
    expect(p.variants[0]).toMatchObject({ priceDelta: 0, inStock: true });
    expect(r.res.headers.get("cache-control")).toMatch(/public/);
  });

  it("filters by category, sale and search; sorts by price", async () => {
    const c = new Client();
    const vision = await c.call(products.GET, "GET", "/api/v1/products", { query: { category: "vision" } });
    expect(vision.data.items.every((p: ProductDTO) => p.category === "vision")).toBe(true);
    const sale = await c.call(products.GET, "GET", "/api/v1/products", { query: { sale: "1" } });
    expect(sale.data.items.length).toBeGreaterThan(0);
    expect(sale.data.items.every((p: ProductDTO) => p.compareAt && p.compareAt > p.price)).toBe(true);
    const asc = await c.call(products.GET, "GET", "/api/v1/products", { query: { sort: "price-asc" } });
    const prices = asc.data.items.map((p: ProductDTO) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const q = await c.call(products.GET, "GET", "/api/v1/products", { query: { q: "dash" } });
    expect(q.data.items.map((p: ProductDTO) => p.slug)).toContain("roadeye-dual-dash-cam");
  });

  it("treats LIKE wildcards and SQL in search literally", async () => {
    const c = new Client();
    expect((await c.call(products.GET, "GET", "/api/v1/products", { query: { q: "%" } })).data.total).toBe(0);
    expect((await c.call(products.GET, "GET", "/api/v1/products", { query: { q: "_" } })).data.total).toBe(0);
    const inj = await c.call(products.GET, "GET", "/api/v1/products", { query: { q: "' or 1=1 --" } });
    expect(inj.status).toBe(200);
    expect(inj.data.total).toBe(0);
  });

  it("rejects invalid query params", async () => {
    const r = await new Client().call(products.GET, "GET", "/api/v1/products", { query: { sort: "drop table", pageSize: "1000" } });
    expect(r.status).toBe(422);
  });

  it("returns product detail with specs in both locales, 404 for unknown", async () => {
    const p = await getProduct("jumpcore-1000-starter");
    expect(p.detail?.specs.fr.length).toBeGreaterThan(0);
    expect(p.detail?.description.ar).toBeTruthy();
    const missing = await new Client().call(product.GET, "GET", "/api/v1/products/nope", { params: { slug: "nope" } });
    expect(missing.status).toBe(404);
  });

  it("serves categories and search suggestions", async () => {
    const cats = await new Client().call(categories.GET, "GET", "/api/v1/categories");
    expect(cats.data.items.map((c: { slug: string }) => c.slug)).toEqual(["vision", "power", "interior", "care"]);
    const s = await new Client().call(suggest.GET, "GET", "/api/v1/search/suggest", { query: { q: "jump" } });
    expect(s.data.items[0]).toMatchObject({ kind: "product", slug: "jumpcore-1000-starter" });
  });
});

describe("cart", () => {
  it("creates a guest cart on first add (httpOnly cookie) and prices server-side", async () => {
    const p = await getProduct("gripdash-phone-mount");
    const c = new Client();
    const r = await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[1].id, qty: 2 } });
    expect(r.status).toBe(200);
    expect(c.cookie("ht_cart")).toBeTruthy();
    expect(r.data.cart.lines[0]).toMatchObject({ qty: 2, unitPrice: p.variants[1].price, lineTotal: p.variants[1].price * 2 });
    expect(r.data.cart.subtotal).toBe(p.variants[1].price * 2);
    expect((await c.call(cart.GET, "GET", "/api/v1/cart")).data.cart.count).toBe(2);
  });

  it("merges repeated adds and caps a line at 10 units", async () => {
    const p = await getProduct("snowfoam-cannon-lance");
    const c = new Client();
    await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id, qty: 8 } });
    const r = await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id, qty: 8 } });
    expect(r.data.cart.lines).toHaveLength(1);
    expect(r.data.cart.lines[0].qty).toBe(10);
  });

  it("updates and removes lines; ignores client-sent prices", async () => {
    const p = await getProduct("lumencore-led-pair");
    const c = new Client();
    await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id, qty: 1, price: 1 } });
    const upd = await c.call(cartItem.PATCH, "PATCH", `/api/v1/cart/items/${p.variants[0].id}`, { params: { variantId: p.variants[0].id }, body: { qty: 3 } });
    expect(upd.data.cart.lines[0]).toMatchObject({ qty: 3, unitPrice: p.price });
    const del = await c.call(cartItem.DELETE, "DELETE", `/api/v1/cart/items/${p.variants[0].id}`, { params: { variantId: p.variants[0].id } });
    expect(del.data.cart.lines).toHaveLength(0);
  });

  it("refuses out-of-stock and unknown variants", async () => {
    const p = await getProduct("tactical-seatback-panel");
    await db.update(productVariants).set({ stock: 0 }).where(eq(productVariants.id, p.variants[0].id));
    const c = new Client();
    const r = await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id } });
    expect(r.data.error.code).toBe("OUT_OF_STOCK");
    const u = await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: uuid() } });
    expect(u.status).toBe(404);
    await db.update(productVariants).set({ stock: 25 }).where(eq(productVariants.id, p.variants[0].id));
  });

  it("applies DRIVE10 case-insensitively and rejects unknown codes", async () => {
    const p = await getProduct("jumpcore-1000-starter");
    const c = new Client();
    await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id } });
    const bad = await c.call(promo.POST, "POST", "/api/v1/cart/promo", { body: { code: "FREESTUFF" } });
    expect(bad.data.error.code).toBe("PROMO_INVALID");
    const ok = await c.call(promo.POST, "POST", "/api/v1/cart/promo", { body: { code: "drive10" } });
    expect(ok.data.cart.discount).toBe(Math.round(p.price * 0.1));
    expect(ok.data.cart.total).toBe(p.price - Math.round(p.price * 0.1));
    const rm = await c.call(promo.DELETE, "DELETE", "/api/v1/cart/promo");
    expect(rm.data.cart.discount).toBe(0);
  });
});

describe("checkout", () => {
  it("validates contact/address fields", async () => {
    const p = await getProduct("precisionfill-inflator");
    const c = new Client();
    await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id } });
    const r = await c.call(orders.POST, "POST", "/api/v1/orders", {
      body: checkoutBody({ contact: { name: "", phone: "123" }, address: { line1: "", commune: "", wilaya: "99" } }),
    });
    expect(r.status).toBe(422);
    expect(Object.keys(r.data.error.fields)).toEqual(expect.arrayContaining(["contact.name", "contact.phone", "address.wilaya"]));
  });

  it("refuses an empty cart", async () => {
    const r = await new Client().call(orders.POST, "POST", "/api/v1/orders", { body: checkoutBody() });
    expect(r.data.error.code).toBe("CART_EMPTY");
  });

  it("places a COD order: snapshots lines, decrements stock, clears cart, logs inventory", async () => {
    const p = await getProduct("scanpro-v302-obd2");
    const v = p.variants[1];
    const before = await stockOf(v.id);
    const c = new Client();
    await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: v.id, qty: 2 } });
    await c.call(promo.POST, "POST", "/api/v1/cart/promo", { body: { code: "DRIVE10" } });
    const r = await c.call(orders.POST, "POST", "/api/v1/orders", { body: checkoutBody() });
    expect(r.status).toBe(201);
    const o = r.data.order;
    expect(o.number).toMatch(/^HT-\d{6}$/);
    expect(o).toMatchObject({ status: "pending", stage: "processing", paymentMethod: "cod", paymentStatus: "unpaid", shippingFee: 0 });
    expect(o.subtotal).toBe(v.price * 2);
    expect(o.discount).toBe(Math.round(v.price * 2 * 0.1));
    expect(o.total).toBe(o.subtotal - o.discount);
    expect(o.items[0]).toMatchObject({ slug: p.slug, qty: 2, unitPrice: v.price, variant: v.label });
    expect(o.address.phone).toBe("0550123456"); // normalized
    expect(r.data.accessKey).toBeTruthy(); // guest
    expect(await stockOf(v.id)).toBe(before - 2);
    const moves = await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, v.id));
    expect(moves.some((m) => m.reason === "order" && m.delta === -2)).toBe(true);
    expect((await c.call(cart.GET, "GET", "/api/v1/cart")).data.cart.lines).toHaveLength(0);
    const [promoRow] = await db.select().from(promotions).where(eq(promotions.code, "DRIVE10"));
    expect(promoRow.usedCount).toBe(1);
  });

  it("is idempotent: replaying the same key returns the same order without double-charging stock", async () => {
    const p = await getProduct("cargofold-trunk-organizer");
    const v = p.variants[0];
    const c = new Client();
    await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: v.id, qty: 1 } });
    const body = checkoutBody();
    const before = await stockOf(v.id);
    const [a, b] = await Promise.all([
      c.call(orders.POST, "POST", "/api/v1/orders", { body }),
      c.call(orders.POST, "POST", "/api/v1/orders", { body }),
    ]);
    expect(a.data.order.number).toBe(b.data.order.number);
    expect(await stockOf(v.id)).toBe(before - 1);
    const again = await c.call(orders.POST, "POST", "/api/v1/orders", { body });
    expect(again.data.order.number).toBe(a.data.order.number);
  });

  it("never oversells: concurrent checkouts for the last units", async () => {
    const p = await getProduct("airvac-2in1-cordless");
    const v = p.variants[0];
    await db.update(productVariants).set({ stock: 3 }).where(eq(productVariants.id, v.id));
    const shoppers = Array.from({ length: 5 }, () => new Client());
    for (const s of shoppers) await s.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: v.id, qty: 1 } });
    const results = await Promise.all(shoppers.map((s) => s.call(orders.POST, "POST", "/api/v1/orders", { body: checkoutBody() })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.data?.error?.code === "OUT_OF_STOCK")).toHaveLength(2);
    expect(await stockOf(v.id)).toBe(0);
  });

  it("enforces promotion usage limits at checkout", async () => {
    await db.insert(promotions).values({ code: "ONCE", type: "fixed", value: 500, usageLimit: 1, isActive: true });
    const p = await getProduct("sportgrip-wheel-cover");
    const first = new Client();
    const second = new Client();
    for (const c of [first, second]) {
      await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id } });
      await c.call(promo.POST, "POST", "/api/v1/cart/promo", { body: { code: "ONCE" } });
    }
    expect((await first.call(orders.POST, "POST", "/api/v1/orders", { body: checkoutBody() })).status).toBe(201);
    const r = await second.call(orders.POST, "POST", "/api/v1/orders", { body: checkoutBody() });
    expect(r.data.error.code).toBe("PROMO_INVALID");
  });

  it("enforces per-customer promo limits by phone for guests", async () => {
    await db.insert(promotions).values({ code: "WELCOME", type: "percent", value: 5, perUserLimit: 1, isActive: true });
    const p = await getProduct("gripdash-phone-mount");
    const run = async () => {
      const c = new Client();
      await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id } });
      await c.call(promo.POST, "POST", "/api/v1/cart/promo", { body: { code: "WELCOME" } });
      return c.call(orders.POST, "POST", "/api/v1/orders", { body: checkoutBody({ contact: { name: "Same Person", phone: "0661 22 33 44" } }) });
    };
    expect((await run()).status).toBe(201);
    expect((await run()).data.error.code).toBe("PROMO_INVALID");
  });
});

describe("guest → account cart merge", () => {
  it("adopts the guest cart on registration and on login", async () => {
    const p = await getProduct("roadeye-dual-dash-cam");
    const c = new Client();
    await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[1].id, qty: 2 } });
    await c.call(register.POST, "POST", "/api/v1/auth/register", {
      body: { name: "Karim Haddad", email: "karim@example.dz", password: "Karim-pass-1", acceptTerms: true },
    });
    expect(c.cookie("ht_cart")).toBeUndefined();
    const s = await c.call(session.POST, "POST", "/api/v1/auth/session");
    expect(s.data.cart.lines[0]).toMatchObject({ variantId: p.variants[1].id, qty: 2 });

    const guest = new Client();
    await guest.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[1].id, qty: 1 } });
    await guest.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "karim@example.dz", password: "Karim-pass-1" } });
    const merged = await guest.call(session.POST, "POST", "/api/v1/auth/session");
    expect(merged.data.cart.lines[0].qty).toBe(3);
  });
});
