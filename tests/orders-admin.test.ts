import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { ADMIN, checkoutBody, Client, freshDb } from "./helpers";
import * as product from "@/app/api/v1/products/[slug]/route";
import * as cartItems from "@/app/api/v1/cart/items/route";
import * as orders from "@/app/api/v1/orders/route";
import * as orderGet from "@/app/api/v1/orders/[number]/route";
import * as orderCancel from "@/app/api/v1/orders/[number]/cancel/route";
import * as register from "@/app/api/v1/auth/register/route";
import * as login from "@/app/api/v1/auth/login/route";
import * as me from "@/app/api/v1/me/route";
import * as myOrders from "@/app/api/v1/me/orders/route";
import * as reviews from "@/app/api/v1/products/[slug]/reviews/route";
import * as fav from "@/app/api/v1/me/favorites/[slug]/route";
import * as adminOrders from "@/app/api/v1/admin/orders/route";
import * as adminOrder from "@/app/api/v1/admin/orders/[number]/route";
import * as adminStatus from "@/app/api/v1/admin/orders/[number]/status/route";
import * as adminProducts from "@/app/api/v1/admin/products/route";
import * as adminImages from "@/app/api/v1/admin/products/[id]/images/route";
import * as adminStock from "@/app/api/v1/admin/variants/[id]/stock/route";
import * as adminCustomers from "@/app/api/v1/admin/customers/[id]/route";
import * as adminPromos from "@/app/api/v1/admin/promotions/route";
import * as adminReview from "@/app/api/v1/admin/reviews/[id]/route";
import * as adminAudit from "@/app/api/v1/admin/audit/route";
import * as adminStats from "@/app/api/v1/admin/stats/route";
import { auditLogs, productVariants, users } from "@/server/db/schema";
import type { Db } from "@/server/db/client";
import type { ProductDTO } from "@/lib/api-types";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await freshDb()));
afterAll(async () => {
  rmSync(path.join(process.cwd(), "public", "uploads", "products", "tirepro-gauge"), { recursive: true, force: true });
  await close();
});

const getProduct = async (slug: string): Promise<ProductDTO> =>
  (await new Client().call(product.GET, "GET", `/api/v1/products/${slug}`, { params: { slug } })).data.product;

async function customer(email: string) {
  const c = new Client();
  const r = await c.call(register.POST, "POST", "/api/v1/auth/register", { body: { name: "Test Customer", email, password: "Customer-pass1", acceptTerms: true } });
  return { c, id: r.data.user.id as string };
}
async function admin() {
  const c = new Client();
  await c.call(login.POST, "POST", "/api/v1/auth/login", { body: ADMIN });
  return c;
}
async function buy(c: Client, slug: string, qty = 1) {
  const p = await getProduct(slug);
  await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id, qty } });
  const r = await c.call(orders.POST, "POST", "/api/v1/orders", { body: checkoutBody({ saveAddress: true }) });
  expect(r.status).toBe(201);
  return { order: r.data.order, accessKey: r.data.accessKey as string | null, product: p };
}
const stockOf = async (id: string) => (await db.select({ s: productVariants.stock }).from(productVariants).where(eq(productVariants.id, id)))[0].s;

describe("order access control (IDOR)", () => {
  it("only the owner can read an account order; others get 404", async () => {
    const alice = await customer("alice@example.dz");
    const bob = await customer("bob@example.dz");
    const { order } = await buy(alice.c, "jumpcore-1000-starter");
    const own = await alice.c.call(orderGet.GET, "GET", `/api/v1/orders/${order.number}`, { params: { number: order.number } });
    expect(own.data.order.number).toBe(order.number);
    const other = await bob.c.call(orderGet.GET, "GET", `/api/v1/orders/${order.number}`, { params: { number: order.number } });
    expect(other.status).toBe(404);
    const anon = await new Client().call(orderGet.GET, "GET", `/api/v1/orders/${order.number}`, { params: { number: order.number } });
    expect(anon.status).toBe(404);
    const list = await bob.c.call(myOrders.GET, "GET", "/api/v1/me/orders");
    expect(list.data.items).toHaveLength(0);
  });

  it("guest orders require the secret access key", async () => {
    const g = new Client();
    const { order, accessKey } = await buy(g, "gripdash-phone-mount");
    const without = await new Client().call(orderGet.GET, "GET", `/api/v1/orders/${order.number}`, { params: { number: order.number } });
    expect(without.status).toBe(404);
    const wrong = await new Client().call(orderGet.GET, "GET", `/api/v1/orders/${order.number}`, { params: { number: order.number }, headers: { "x-order-key": "guess" } });
    expect(wrong.status).toBe(404);
    const ok = await new Client().call(orderGet.GET, "GET", `/api/v1/orders/${order.number}`, { params: { number: order.number }, headers: { "x-order-key": accessKey! } });
    expect(ok.data.order.number).toBe(order.number);
  });

  it("saves the checkout address as the account default", async () => {
    const r = await (await customer("addr@example.dz")).c;
    await buy(r, "lumencore-led-pair");
    const m = await r.call(me.GET, "GET", "/api/v1/me");
    expect(m.data.user.defaultAddress).toMatchObject({ commune: "Alger Centre", wilaya: "16" });
    expect(m.data.user.phone).toBe("0550123456");
  });
});

describe("cancellation", () => {
  it("customer can cancel a pending order; stock and promo usage are restored", async () => {
    const { c } = await customer("cancel@example.dz");
    const p = await getProduct("snowfoam-cannon-lance");
    const before = await stockOf(p.variants[0].id);
    const { order } = await buy(c, p.slug, 2);
    expect(await stockOf(p.variants[0].id)).toBe(before - 2);
    const r = await c.call(orderCancel.POST, "POST", `/api/v1/orders/${order.number}/cancel`, { params: { number: order.number } });
    expect(r.data.order).toMatchObject({ status: "cancelled", stage: "cancelled", cancellable: false });
    expect(await stockOf(p.variants[0].id)).toBe(before);
    const again = await c.call(orderCancel.POST, "POST", `/api/v1/orders/${order.number}/cancel`, { params: { number: order.number } });
    expect(again.data.error.code).toBe("ORDER_NOT_CANCELLABLE");
  });
});

describe("staff order workflow", () => {
  it("moves an order through the lifecycle, records tracking and audit logs", async () => {
    const { c } = await customer("flow@example.dz");
    const { order } = await buy(c, "precisionfill-inflator");
    const a = await admin();
    const step = (status: string, extra = {}) =>
      a.call(adminStatus.POST, "POST", `/api/v1/admin/orders/${order.number}/status`, { params: { number: order.number }, body: { status, ...extra } });
    expect((await step("packed")).data.error.code).toBe("INVALID_TRANSITION"); // must confirm first
    expect((await step("confirmed")).status).toBe(200);
    expect((await step("packed")).status).toBe(200);
    const shipped = await step("shipped", { carrier: "Yalidine", trackingNumber: "YAL-123" });
    expect(shipped.data.order).toMatchObject({ stage: "shipped", carrier: "Yalidine", trackingNumber: "YAL-123" });
    await step("out_for_delivery");
    const delivered = await step("delivered");
    expect(delivered.data.order).toMatchObject({ stage: "delivered", paymentStatus: "paid" });
    expect(delivered.data.order.timeline.every((t: { at: string | null }) => t.at)).toBe(true);

    const fee = await a.call(adminOrder.PATCH, "PATCH", `/api/v1/admin/orders/${order.number}`, { params: { number: order.number }, body: { shippingFee: 600 } });
    expect(fee.data.error.code).toBe("CONFLICT"); // closed order

    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.entityType, "order"), eq(auditLogs.entityId, order.number)));
    expect(logs.length).toBe(5);
    const list = await a.call(adminOrders.GET, "GET", "/api/v1/admin/orders", { query: { q: order.number } });
    expect(list.data.items[0].number).toBe(order.number);
    expect((await a.call(adminStats.GET, "GET", "/api/v1/admin/stats")).data.ordersByStatus.delivered).toBeGreaterThanOrEqual(1);
  });
});

describe("reviews", () => {
  it("only verified buyers with a delivered order can review, once; rating is recomputed", async () => {
    const { c } = await customer("reviewer@example.dz");
    const { order, product: p } = await buy(c, "cargofold-trunk-organizer");
    const post = () => c.call(reviews.POST, "POST", `/api/v1/products/${p.slug}/reviews`, { params: { slug: p.slug }, body: { rating: 4, body: "Solide et pratique au quotidien." } });
    expect((await post()).data.error.code).toBe("REVIEW_NOT_ALLOWED");
    const a = await admin();
    for (const s of ["confirmed", "packed", "shipped", "delivered"]) {
      await a.call(adminStatus.POST, "POST", `/api/v1/admin/orders/${order.number}/status`, { params: { number: order.number }, body: { status: s } });
    }
    const listBefore = await c.call(reviews.GET, "GET", `/api/v1/products/${p.slug}/reviews`, { params: { slug: p.slug } });
    expect(listBefore.data.canReview).toBe(true);
    const created = await post();
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ rating: 4, count: 1, canReview: false });
    expect(created.data.items[0]).toMatchObject({ author: "Test C.", mine: true });
    expect((await post()).data.error.code).toBe("CONFLICT");
    expect((await getProduct(p.slug)).rating).toBe(4);

    const hide = await a.call(adminReview.PATCH, "PATCH", `/api/v1/admin/reviews/${created.data.items[0].id}`, { params: { id: created.data.items[0].id }, body: { status: "hidden" } });
    expect(hide.status).toBe(200);
    expect((await getProduct(p.slug)).reviews).toBe(0);
  });
});

describe("favorites", () => {
  it("persists per user", async () => {
    const { c } = await customer("fav@example.dz");
    const r = await c.call(fav.PUT, "PUT", "/api/v1/me/favorites/jumpcore-1000-starter", { params: { slug: "jumpcore-1000-starter" } });
    expect(r.data.slugs).toEqual(["jumpcore-1000-starter"]);
    const d = await c.call(fav.DELETE, "DELETE", "/api/v1/me/favorites/jumpcore-1000-starter", { params: { slug: "jumpcore-1000-starter" } });
    expect(d.data.slugs).toEqual([]);
  });
});

describe("RBAC", () => {
  it("customers and anonymous users cannot reach admin endpoints", async () => {
    const { c } = await customer("nosy@example.dz");
    expect((await c.call(adminOrders.GET, "GET", "/api/v1/admin/orders")).status).toBe(403);
    expect((await new Client().call(adminOrders.GET, "GET", "/api/v1/admin/orders")).status).toBe(401);
    expect((await c.call(adminAudit.GET, "GET", "/api/v1/admin/audit")).status).toBe(403);
  });

  it("staff can manage orders but not promotions, roles or the audit log", async () => {
    const { c, id } = await customer("staff@example.dz");
    await db.update(users).set({ role: "staff" }).where(eq(users.id, id));
    const staff = new Client();
    await staff.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "staff@example.dz", password: "Customer-pass1" } });
    expect((await staff.call(adminOrders.GET, "GET", "/api/v1/admin/orders")).status).toBe(200);
    expect((await staff.call(adminPromos.GET, "GET", "/api/v1/admin/promotions")).status).toBe(403);
    expect((await staff.call(adminAudit.GET, "GET", "/api/v1/admin/audit")).status).toBe(403);
    expect((await staff.call(adminCustomers.PATCH, "PATCH", `/api/v1/admin/customers/${id}`, { params: { id }, body: { role: "admin" } })).status).toBe(403);
    void c;
  });

  it("disabling a customer revokes their live session immediately", async () => {
    const victim = await customer("disabled@example.dz");
    expect((await victim.c.call(me.GET, "GET", "/api/v1/me")).status).toBe(200);
    const a = await admin();
    const r = await a.call(adminCustomers.PATCH, "PATCH", `/api/v1/admin/customers/${victim.id}`, { params: { id: victim.id }, body: { status: "disabled" } });
    expect(r.data.customer.status).toBe("disabled");
    expect((await victim.c.call(me.GET, "GET", "/api/v1/me")).status).toBe(401);
    expect((await new Client().call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "disabled@example.dz", password: "Customer-pass1" } })).data.error.code).toBe("ACCOUNT_DISABLED");
  });

  it("admin cannot demote themselves", async () => {
    const a = await admin();
    const meRes = await a.call(me.GET, "GET", "/api/v1/me");
    const r = await a.call(adminCustomers.PATCH, "PATCH", `/api/v1/admin/customers/${meRes.data.user.id}`, { params: { id: meRes.data.user.id }, body: { role: "customer" } });
    expect(r.status).toBe(409);
  });
});

describe("admin catalogue", () => {
  it("creates a product with variants, adjusts stock and uploads an optimized image", async () => {
    const a = await admin();
    const created = await a.call(adminProducts.POST, "POST", "/api/v1/admin/products", {
      body: {
        slug: "tirepro-gauge",
        name: "TirePro Gauge",
        categorySlug: "power",
        status: "active",
        translations: {
          fr: { short: "Manomètre numérique.", description: "Lecture précise de la pression.", specs: [["Plage", "0–10 bar"]] },
          ar: { short: "مقياس رقمي.", description: "قراءة دقيقة للضغط." },
        },
        variants: [{ code: "std", sku: "TIREPRO-STD", price: 2900, stock: 5, labels: { fr: "Standard", ar: "عادي" } }],
      },
    });
    expect(created.status).toBe(201);
    const id = created.data.product.id;
    expect((await getProduct("tirepro-gauge")).price).toBe(2900);

    const dup = await a.call(adminProducts.POST, "POST", "/api/v1/admin/products", {
      body: { slug: "tirepro-gauge", name: "x", categorySlug: "power", translations: { fr: { short: "x", description: "y" } } },
    });
    expect(dup.status).toBe(409);

    const variantId = created.data.product.adminVariants[0].id;
    const neg = await a.call(adminStock.POST, "POST", `/api/v1/admin/variants/${variantId}/stock`, { params: { id: variantId }, body: { delta: -10, reason: "adjustment" } });
    expect(neg.status).toBe(422);
    const adj = await a.call(adminStock.POST, "POST", `/api/v1/admin/variants/${variantId}/stock`, { params: { id: variantId }, body: { delta: 7, reason: "restock", note: "Supplier delivery" } });
    expect(adj.data.stock).toBe(12);

    const png = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#d0d0c8" } }).png().toBuffer();
    const form = new FormData();
    form.set("file", new File([new Uint8Array(png)], "photo.png", { type: "image/png" }));
    const up = await a.call(adminImages.POST, "POST", `/api/v1/admin/products/${id}/images`, { params: { id }, raw: form });
    expect(up.status).toBe(201);
    expect(up.data.image.url).toMatch(/\.webp$/);
    const file = path.join(process.cwd(), "public", up.data.image.variants.md);
    expect(existsSync(file)).toBe(true);
    const meta = await sharp(file).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 800 });

    const fake = new FormData();
    fake.set("file", new File([new TextEncoder().encode("<?php echo 1; ?>")], "x.png", { type: "image/png" }));
    const bad = await a.call(adminImages.POST, "POST", `/api/v1/admin/products/${id}/images`, { params: { id }, raw: fake });
    expect(bad.status).toBe(415);
  });
});
