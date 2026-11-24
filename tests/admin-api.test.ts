import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ADMIN, checkoutBody, Client, freshDb } from "./helpers";
import * as product from "@/app/api/v1/products/[slug]/route";
import * as cartItems from "@/app/api/v1/cart/items/route";
import * as orders from "@/app/api/v1/orders/route";
import * as register from "@/app/api/v1/auth/register/route";
import * as login from "@/app/api/v1/auth/login/route";
import * as reviews from "@/app/api/v1/products/[slug]/reviews/route";
import * as adminMe from "@/app/api/v1/admin/me/route";
import * as adminRoles from "@/app/api/v1/admin/roles/route";
import * as analytics from "@/app/api/v1/admin/analytics/route";
import * as adminProducts from "@/app/api/v1/admin/products/route";
import * as adminProduct from "@/app/api/v1/admin/products/[id]/route";
import * as productBulk from "@/app/api/v1/admin/products/bulk/route";
import * as inventory from "@/app/api/v1/admin/inventory/route";
import * as movements from "@/app/api/v1/admin/inventory/movements/route";
import * as inventoryBulk from "@/app/api/v1/admin/inventory/bulk/route";
import * as categories from "@/app/api/v1/admin/categories/route";
import * as category from "@/app/api/v1/admin/categories/[slug]/route";
import * as adminOrders from "@/app/api/v1/admin/orders/route";
import * as adminOrder from "@/app/api/v1/admin/orders/[number]/route";
import * as adminStatus from "@/app/api/v1/admin/orders/[number]/status/route";
import * as bulkStatus from "@/app/api/v1/admin/orders/bulk-status/route";
import * as orderExport from "@/app/api/v1/admin/orders/export/route";
import * as customers from "@/app/api/v1/admin/customers/route";
import * as customer from "@/app/api/v1/admin/customers/[id]/route";
import * as customerSessions from "@/app/api/v1/admin/customers/[id]/sessions/route";
import * as promotions from "@/app/api/v1/admin/promotions/route";
import * as promotion from "@/app/api/v1/admin/promotions/[id]/route";
import * as adminReviews from "@/app/api/v1/admin/reviews/route";
import * as reviewBulk from "@/app/api/v1/admin/reviews/bulk/route";
import * as audit from "@/app/api/v1/admin/audit/route";
import * as carriers from "@/app/api/v1/admin/carriers/route";
import * as carrier from "@/app/api/v1/admin/carriers/[id]/route";
import * as system from "@/app/api/v1/admin/system/route";
import * as purge from "@/app/api/v1/admin/system/purge-carts/route";
import * as newsletter from "@/app/api/v1/admin/newsletter/route";
import { users } from "@/server/db/schema";
import type { Db } from "@/server/db/client";
import type { ProductDTO } from "@/lib/api-types";

let db: Db;
let close: () => Promise<void>;
let a: Client;
let staff: Client;
let shopper: Client;
let shopperId: string;

const getProduct = async (slug: string): Promise<ProductDTO> =>
  (await new Client().call(product.GET, "GET", `/api/v1/products/${slug}`, { params: { slug } })).data.product;

async function signUp(email: string, name = "Test Customer") {
  const c = new Client();
  const r = await c.call(register.POST, "POST", "/api/v1/auth/register", { body: { name, email, password: "Customer-pass1", acceptTerms: true } });
  return { c, id: r.data.user.id as string };
}
async function buy(c: Client, slug: string, qty = 1) {
  const p = await getProduct(slug);
  await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: p.variants[0].id, qty } });
  const r = await c.call(orders.POST, "POST", "/api/v1/orders", { body: checkoutBody() });
  expect(r.status).toBe(201);
  return r.data.order as { number: string; total: number };
}
const move = (number: string, status: string, extra: Record<string, unknown> = {}) =>
  a.call(adminStatus.POST, "POST", `/api/v1/admin/orders/${number}/status`, { params: { number }, body: { status, ...extra } });

beforeAll(async () => {
  ({ db, close } = await freshDb());
  a = new Client();
  await a.call(login.POST, "POST", "/api/v1/auth/login", { body: ADMIN });
  const s = await signUp("staff@example.dz", "Sami Staff");
  await db.update(users).set({ role: "staff" }).where(eq(users.id, s.id));
  staff = new Client();
  await staff.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "staff@example.dz", password: "Customer-pass1" } });
  ({ c: shopper, id: shopperId } = await signUp("shopper@example.dz", "Amina Shopper"));
});
afterAll(async () => close());

describe("admin identity", () => {
  it("returns permissions for staff and admins, 403 for customers", async () => {
    const me = await a.call(adminMe.GET, "GET", "/api/v1/admin/me");
    expect(me.data.user.role).toBe("admin");
    expect(me.data.permissions).toContain("settings:manage");
    const sm = await staff.call(adminMe.GET, "GET", "/api/v1/admin/me");
    expect(sm.data.permissions).not.toContain("settings:manage");
    expect((await shopper.call(adminMe.GET, "GET", "/api/v1/admin/me")).status).toBe(403);
    expect((await new Client().call(adminMe.GET, "GET", "/api/v1/admin/me")).status).toBe(401);
    const roles = await staff.call(adminRoles.GET, "GET", "/api/v1/admin/roles");
    expect(roles.data.roles.map((r: { role: string }) => r.role)).toEqual(["customer", "staff", "admin"]);
  });
});

describe("analytics", () => {
  it("reports KPIs, a zero-filled daily series and breakdowns", async () => {
    const o = await buy(shopper, "jumpcore-1000-starter", 2);
    const r = await a.call(analytics.GET, "GET", "/api/v1/admin/analytics", { query: { days: "7" } });
    expect(r.status).toBe(200);
    expect(r.data.series).toHaveLength(7);
    expect(r.data.kpis.orders).toBeGreaterThanOrEqual(1);
    expect(r.data.kpis.grossSales).toBeGreaterThanOrEqual(o.total);
    expect(r.data.topProducts[0]).toMatchObject({ slug: "jumpcore-1000-starter", units: 2 });
    expect(r.data.regions[0].wilaya).toBe("16");
    expect(r.data.recentOrders[0].number).toBe(o.number);
    expect((await a.call(analytics.GET, "GET", "/api/v1/admin/analytics", { query: { days: "12" } })).status).toBe(422);
    expect((await shopper.call(analytics.GET, "GET", "/api/v1/admin/analytics")).status).toBe(403);
  });
});

describe("products", () => {
  it("sorts, filters by stock and searches by SKU", async () => {
    const byName = await a.call(adminProducts.GET, "GET", "/api/v1/admin/products", { query: { sort: "name", pageSize: "100" } });
    const names = byName.data.items.map((p: { name: string }) => p.name);
    expect(names).toEqual([...names].sort((x: string, y: string) => x.localeCompare(y, "en", { sensitivity: "base" })));
    expect(byName.data.items.every((p: { totalStock: number; variantCount: number }) => p.totalStock > 0 && p.variantCount > 0)).toBe(true);
    const sku = byName.data.items[0];
    const full = await a.call(adminProduct.GET, "GET", `/api/v1/admin/products/${sku.id}`, { params: { id: sku.id } });
    const bySku = await a.call(adminProducts.GET, "GET", "/api/v1/admin/products", { query: { search: full.data.product.adminVariants[0].sku } });
    expect(bySku.data.items.map((p: { id: string }) => p.id)).toContain(sku.id);
    const out = await a.call(adminProducts.GET, "GET", "/api/v1/admin/products", { query: { stock: "out" } });
    expect(out.data.total).toBe(0);
  });

  it("bulk-updates status and flags in one call (audited)", async () => {
    const list = await a.call(adminProducts.GET, "GET", "/api/v1/admin/products", { query: { pageSize: "2" } });
    const ids = list.data.items.map((p: { id: string }) => p.id);
    const r = await a.call(productBulk.POST, "POST", "/api/v1/admin/products/bulk", { body: { ids, patch: { status: "draft", isFeatured: true } } });
    expect(r.data.updated).toBe(2);
    const drafts = await a.call(adminProducts.GET, "GET", "/api/v1/admin/products", { query: { status: "draft" } });
    expect(drafts.data.items.map((p: { id: string }) => p.id).sort()).toEqual([...ids].sort());
    expect((await a.call(productBulk.POST, "POST", "/api/v1/admin/products/bulk", { body: { ids, patch: {} } })).status).toBe(422);
    await a.call(productBulk.POST, "POST", "/api/v1/admin/products/bulk", { body: { ids, patch: { status: "active" } } });
    const log = await a.call(audit.GET, "GET", "/api/v1/admin/audit", { query: { action: "product.bulk" } });
    expect(log.data.total).toBe(4);
    expect(log.data.items[0].actorEmail).toBe(ADMIN.email);
    expect((await shopper.call(productBulk.POST, "POST", "/api/v1/admin/products/bulk", { body: { ids, patch: { status: "draft" } } })).status).toBe(403);
  });

  it("rejects a stale edit with 409 (optimistic concurrency)", async () => {
    const list = await a.call(adminProducts.GET, "GET", "/api/v1/admin/products", { query: { pageSize: "1" } });
    const id = list.data.items[0].id;
    const loaded = (await a.call(adminProduct.GET, "GET", `/api/v1/admin/products/${id}`, { params: { id } })).data.product;
    const first = await a.call(adminProduct.PATCH, "PATCH", `/api/v1/admin/products/${id}`, { params: { id }, body: { name: "Edited once", expectedUpdatedAt: loaded.updatedAt } });
    expect(first.status).toBe(200);
    const stale = await staff.call(adminProduct.PATCH, "PATCH", `/api/v1/admin/products/${id}`, { params: { id }, body: { name: "Lost update", expectedUpdatedAt: loaded.updatedAt } });
    expect(stale.status).toBe(409);
    expect(stale.data.error.reason).toBe("stale");
    const fresh = await staff.call(adminProduct.PATCH, "PATCH", `/api/v1/admin/products/${id}`, { params: { id }, body: { name: loaded.name, expectedUpdatedAt: first.data.product.updatedAt } });
    expect(fresh.status).toBe(200);
  });
});

describe("inventory", () => {
  it("lists variants with a summary and applies bulk adjustments atomically", async () => {
    const list = await a.call(inventory.GET, "GET", "/api/v1/admin/inventory", { query: { sort: "sku", pageSize: "3" } });
    expect(list.data.items).toHaveLength(3);
    expect(list.data.summary.units).toBeGreaterThan(0);
    const [v1, v2] = list.data.items;
    const bad = await a.call(inventoryBulk.POST, "POST", "/api/v1/admin/inventory/bulk", {
      body: { reason: "adjustment", items: [{ variantId: v1.variantId, set: 3 }, { variantId: v2.variantId, delta: -100000 }] },
    });
    expect(bad.status).toBe(422);
    const unchanged = await a.call(inventory.GET, "GET", "/api/v1/admin/inventory", { query: { search: v1.sku } });
    expect(unchanged.data.items[0].stock).toBe(v1.stock);
    const ok = await a.call(inventoryBulk.POST, "POST", "/api/v1/admin/inventory/bulk", {
      body: { reason: "restock", note: "Cycle count", items: [{ variantId: v1.variantId, set: 3 }, { variantId: v2.variantId, delta: 5 }] },
    });
    expect(ok.data.changed).toBe(2);
    const low = await a.call(inventory.GET, "GET", "/api/v1/admin/inventory", { query: { stock: "low" } });
    expect(low.data.items.map((i: { variantId: string }) => i.variantId)).toContain(v1.variantId);
    const ledger = await a.call(movements.GET, "GET", "/api/v1/admin/inventory/movements", { query: { variantId: v2.variantId } });
    expect(ledger.data.items[0]).toMatchObject({ delta: 5, reason: "restock", note: "Cycle count", actorName: "Admin" });
    const dup = await a.call(inventoryBulk.POST, "POST", "/api/v1/admin/inventory/bulk", {
      body: { reason: "restock", items: [{ variantId: v1.variantId, set: 3 }, { variantId: v1.variantId, set: 4 }] },
    });
    expect(dup.status).toBe(422);
  });
});

describe("categories", () => {
  it("lists inactive categories with counts; deletes only empty ones", async () => {
    const body = { slug: "test-empty", isActive: false, translations: { fr: { name: "Vide", short: "Vide" } } };
    expect((await a.call(categories.POST, "POST", "/api/v1/admin/categories", { body })).status).toBe(201);
    const list = await a.call(categories.GET, "GET", "/api/v1/admin/categories");
    const empty = list.data.items.find((c: { slug: string }) => c.slug === "test-empty");
    expect(empty).toMatchObject({ isActive: false, productCount: 0, translations: { fr: { name: "Vide" }, ar: null } });
    const full = list.data.items.find((c: { productCount: number }) => c.productCount > 0);
    const blocked = await a.call(category.DELETE, "DELETE", `/api/v1/admin/categories/${full.slug}`, { params: { slug: full.slug } });
    expect(blocked.status).toBe(409);
    expect((await a.call(category.DELETE, "DELETE", "/api/v1/admin/categories/test-empty", { params: { slug: "test-empty" } })).status).toBe(200);
  });
});

describe("orders", () => {
  it("filters by several statuses, sorts by total and exports CSV", async () => {
    const o1 = await buy(shopper, "gripdash-phone-mount", 1);
    const o2 = await buy(shopper, "jumpcore-1000-starter", 3);
    await move(o2.number, "confirmed");
    const multi = await a.call(adminOrders.GET, "GET", "/api/v1/admin/orders", { query: { status: "pending,confirmed", sort: "total", dir: "asc" } });
    const totals = multi.data.items.map((o: { total: number }) => o.total);
    expect(totals).toEqual([...totals].sort((x: number, y: number) => x - y));
    expect(multi.data.items.map((o: { number: string }) => o.number)).toEqual(expect.arrayContaining([o1.number, o2.number]));
    const csv = await a.call(orderExport.GET, "GET", "/api/v1/admin/orders/export", { query: { q: o2.number } });
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
    expect(csv.data).toBeNull();
    const text = await (await orderExport.GET(new Request(`http://localhost:3000/api/v1/admin/orders/export?q=${o2.number}`, { headers: { cookie: `ht_at=${a.cookie("ht_at")}` } }))).text();
    expect(text.split("\r\n")[1]).toContain(o2.number);
    expect((await a.call(adminOrders.GET, "GET", "/api/v1/admin/orders", { query: { status: "bogus" } })).status).toBe(422);
  });

  it("applies bulk transitions per order and reports failures", async () => {
    const p1 = await buy(shopper, "gripdash-phone-mount", 1);
    const p2 = await buy(shopper, "gripdash-phone-mount", 1);
    await move(p2.number, "cancelled");
    const r = await staff.call(bulkStatus.POST, "POST", "/api/v1/admin/orders/bulk-status", { body: { numbers: [p1.number, p2.number], status: "confirmed", note: "Phone confirmed" } });
    expect(r.data).toMatchObject({ updated: 1, failed: 1 });
    expect(r.data.results.find((x: { number: string }) => x.number === p2.number).code).toBe("INVALID_TRANSITION");
    const detail = await a.call(adminOrder.GET, "GET", `/api/v1/admin/orders/${p1.number}`, { params: { number: p1.number } });
    expect(detail.data.order.events.at(-1)).toMatchObject({ status: "confirmed", note: "Phone confirmed", actorName: "Sami Staff" });
    expect(detail.data.order.items[0].sku).toBeTruthy();
    expect(detail.data.order.account.email).toBe("shopper@example.dz");
  });
});

describe("customers", () => {
  it("filters the team, sorts by spend and shows a full profile", async () => {
    const team = await a.call(customers.GET, "GET", "/api/v1/admin/customers", { query: { scope: "team" } });
    expect(team.data.items.map((u: { role: string }) => u.role).sort()).toEqual(["admin", "staff"]);
    const bySpend = await a.call(customers.GET, "GET", "/api/v1/admin/customers", { query: { sort: "orders", dir: "desc" } });
    expect(bySpend.data.items[0].id).toBe(shopperId);
    expect(bySpend.data.items[0].orderCount).toBeGreaterThan(3);
    const profile = await staff.call(customer.GET, "GET", `/api/v1/admin/customers/${shopperId}`, { params: { id: shopperId } });
    expect(profile.data.customer.stats.orderCount).toBeGreaterThan(0);
    expect(profile.data.customer.stats.activeSessions).toBeGreaterThanOrEqual(1);
  });

  it("revokes sessions (admin only)", async () => {
    const { c, id } = await signUp("revoke@example.dz");
    expect((await staff.call(customerSessions.DELETE, "DELETE", `/api/v1/admin/customers/${id}/sessions`, { params: { id } })).status).toBe(403);
    expect((await a.call(customerSessions.DELETE, "DELETE", `/api/v1/admin/customers/${id}/sessions`, { params: { id } })).status).toBe(200);
    const after = await c.call(adminMe.GET, "GET", "/api/v1/admin/me");
    expect(after.status).toBe(401);
  });
});

describe("promotions", () => {
  it("shows performance, deletes unused codes, refuses used ones", async () => {
    const created = await a.call(promotions.POST, "POST", "/api/v1/admin/promotions", { body: { code: "spring5", type: "fixed", value: 500 } });
    const id = created.data.promotion.id;
    const detail = await a.call(promotion.GET, "GET", `/api/v1/admin/promotions/${id}`, { params: { id } });
    expect(detail.data.promotion).toMatchObject({ code: "SPRING5", orderCount: 0, redemptions: [] });
    const overPercent = await a.call(promotion.PATCH, "PATCH", `/api/v1/admin/promotions/${id}`, { params: { id }, body: { type: "percent" } });
    expect(overPercent.status).toBe(422); // 500% would be invalid
    expect((await a.call(promotion.DELETE, "DELETE", `/api/v1/admin/promotions/${id}`, { params: { id } })).status).toBe(200);
    const list = await a.call(promotions.GET, "GET", "/api/v1/admin/promotions");
    expect(list.data.items.find((p: { code: string }) => p.code === "SPRING5")).toBeUndefined();
    expect(list.data.items.find((p: { code: string }) => p.code === "DRIVE10")).toHaveProperty("revenue", 0);
    expect((await staff.call(promotions.GET, "GET", "/api/v1/admin/promotions")).status).toBe(403);
  });
});

describe("reviews moderation", () => {
  it("lists reviews with counts and bulk-hides them (rating recomputed)", async () => {
    const o = await buy(shopper, "lumencore-led-pair", 1);
    for (const s of ["confirmed", "packed", "shipped", "delivered"]) await move(o.number, s);
    const posted = await shopper.call(reviews.POST, "POST", "/api/v1/products/lumencore-led-pair/reviews", {
      params: { slug: "lumencore-led-pair" },
      body: { rating: 2, title: "Meh", body: "Not as bright as I hoped for." },
    });
    expect(posted.status).toBe(201);
    const list = await staff.call(adminReviews.GET, "GET", "/api/v1/admin/reviews", { query: { q: "bright" } });
    expect(list.data.items[0]).toMatchObject({ rating: 2, verified: true, authorEmail: "shopper@example.dz", status: "published" });
    const r = await staff.call(reviewBulk.POST, "POST", "/api/v1/admin/reviews/bulk", { body: { ids: [list.data.items[0].id], status: "hidden" } });
    expect(r.data.updated).toBe(1);
    expect((await getProduct("lumencore-led-pair")).reviews).toBe(0);
    const hidden = await staff.call(adminReviews.GET, "GET", "/api/v1/admin/reviews", { query: { status: "hidden" } });
    expect(hidden.data.counts.hidden).toBe(1);
  });
});

describe("carriers & system", () => {
  it("lets admins manage carriers; staff can only read them", async () => {
    const seeded = await staff.call(carriers.GET, "GET", "/api/v1/admin/carriers");
    expect(seeded.data.items.map((c: { name: string }) => c.name)).toEqual(["Yalidine", "ZR Express"]);
    expect((await staff.call(carriers.POST, "POST", "/api/v1/admin/carriers", { body: { name: "Maystro" } })).status).toBe(403);
    const c = await a.call(carriers.POST, "POST", "/api/v1/admin/carriers", { body: { name: "Maystro", trackingUrl: "https://example.com/t/{number}" } });
    expect(c.status).toBe(201);
    expect((await a.call(carriers.POST, "POST", "/api/v1/admin/carriers", { body: { name: "maystro" } })).status).toBe(409);
    expect((await a.call(carriers.POST, "POST", "/api/v1/admin/carriers", { body: { name: "X", trackingUrl: "javascript:alert(1)" } })).status).toBe(422);
    const id = c.data.carrier.id;
    const off = await a.call(carrier.PATCH, "PATCH", `/api/v1/admin/carriers/${id}`, { params: { id }, body: { isActive: false } });
    expect(off.data.carrier.isActive).toBe(false);
    expect((await a.call(carrier.DELETE, "DELETE", `/api/v1/admin/carriers/${id}`, { params: { id } })).status).toBe(200);
  });

  it("system status and housekeeping are admin-only", async () => {
    expect((await staff.call(system.GET, "GET", "/api/v1/admin/system")).status).toBe(403);
    const s = await a.call(system.GET, "GET", "/api/v1/admin/system");
    expect(s.data.database.ok).toBe(true);
    const dry = await a.call(purge.POST, "POST", "/api/v1/admin/system/purge-carts", { body: { days: 30, dryRun: true } });
    expect(dry.data).toMatchObject({ deleted: 0 });
    expect((await a.call(purge.POST, "POST", "/api/v1/admin/system/purge-carts", { body: { days: 1 } })).status).toBe(422);
    expect((await staff.call(newsletter.GET, "GET", "/api/v1/admin/newsletter")).status).toBe(200);
  });
});
