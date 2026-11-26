/**
 * Builds an isolated, realistic database for the admin E2E suite (and for
 * local admin demos). Orders are created through the real services (cart →
 * checkout → staff status transitions) and then back-dated, so every derived
 * value (stock ledger, promo usage, ratings, audit log) is consistent.
 *
 *   tsx --conditions=react-server scripts/e2e-seed.ts [.data/e2e]
 *
 * Deterministic: a seeded PRNG drives every random choice.
 */
import { rmSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { createDb, setDb } from "../src/server/db/client";
import { seed } from "../src/server/db/seed/seed";
import { carts, newsletterSubscribers, orders, productVariants, products, promotions, reviews, users } from "../src/server/db/schema";
import { addItem, applyPromo } from "../src/server/services/cart";
import { changeStatusByStaff, placeOrder } from "../src/server/services/orders";
import { createReview } from "../src/server/services/reviews";
import { createPromotion } from "../src/server/services/admin-ops";
import type { OrderStatus } from "../src/lib/api-types";

export const E2E_USERS = {
  admin: { email: "admin@hanutek.test", password: "Admin-pass-2026!", name: "Admin" },
  staff: { email: "staff@hanutek.test", password: "Staff-pass-2026!", name: "Sara Belkacem" },
  /** only used by the password-change test (its sessions get revoked) */
  staff2: { email: "staff2@hanutek.test", password: "Staff2-pass-2026!", name: "Yanis Ouali" },
  customer: { email: "customer@hanutek.test", password: "Customer-pass-2026!", name: "Karim Haddad" },
};

const target = path.resolve(process.argv[2] ?? ".data/e2e");

// mulberry32
let s = 0x9e3779b9;
const rand = () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const weighted = <T>(xs: readonly [T, number][]) => {
  const total = xs.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of xs) if ((r -= w) <= 0) return v;
  return xs[xs.length - 1][0];
};

const FIRST = ["Yacine", "Amina", "Sofiane", "Lina", "Karim", "Nesrine", "Walid", "Imane", "Rachid", "Meriem", "Anis", "Sarah", "Mehdi", "Yasmine", "Nabil", "Houda", "Riad", "Kenza", "Farid", "Dounia", "Samir", "Chahinez", "Adel", "Rania", "Bilal", "Asma", "Hichem", "Selma", "Omar", "Feriel"];
const LAST = ["Benali", "Bouzid", "Haddad", "Cherif", "Mansouri", "Belaid", "Khelifi", "Saadi", "Ziani", "Rahmani", "Bensalem", "Meziane", "Brahimi", "Hamidi", "Lounis", "Taleb", "Amrani", "Djebbar"];
const PLACES: [string, string, number][] = [
  ["16", "Alger Centre", 30],
  ["16", "Bab Ezzouar", 12],
  ["31", "Oran", 14],
  ["25", "Constantine", 10],
  ["09", "Blida", 8],
  ["06", "Béjaïa", 6],
  ["19", "Sétif", 6],
  ["15", "Tizi Ouzou", 5],
  ["23", "Annaba", 5],
  ["13", "Tlemcen", 4],
  ["35", "Boumerdès", 4],
  ["05", "Batna", 3],
];
const STREETS = ["Rue Didouche Mourad", "Boulevard Mohamed V", "Rue Larbi Ben M'hidi", "Cité 1000 Logements", "Rue Hassiba Ben Bouali", "Avenue de l'ALN", "Cité des Orangers"];
const REVIEW_TEXT: [number, string, string][] = [
  [5, "Excellent", "Conforme à la description et livré rapidement. Très satisfait de la qualité."],
  [5, "Top", "Fonctionne parfaitement dans ma voiture, installé en cinq minutes."],
  [4, "Très bien", "Bon produit dans l’ensemble, l’emballage pourrait être meilleur mais il fait le travail."],
  [4, "Satisfait", "Bien construit, un peu cher mais ça vaut le coup pour la fiabilité."],
  [3, "Correct", "Ça marche, mais la notice est seulement en anglais et en chinois."],
  [2, "Déçu", "Le câble est plus court que prévu et le support tient un peu mal."],
  [1, "Déconseillé", "Ne fonctionne plus après deux semaines, j’attends le remplacement."],
];

const STATUS_MIX: [OrderStatus, number][] = [
  ["delivered", 44],
  ["pending", 12],
  ["confirmed", 8],
  ["packed", 6],
  ["shipped", 8],
  ["out_for_delivery", 4],
  ["cancelled", 12],
  ["returned", 6],
];
const PATH: Record<OrderStatus, OrderStatus[]> = {
  pending: [],
  confirmed: ["confirmed"],
  packed: ["confirmed", "packed"],
  shipped: ["confirmed", "packed", "shipped"],
  out_for_delivery: ["confirmed", "packed", "shipped", "out_for_delivery"],
  delivered: ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"],
  cancelled: ["cancelled"],
  returned: ["confirmed", "packed", "shipped", "delivered", "returned"],
};

async function main() {
  rmSync(target, { recursive: true, force: true });
  const { db, migrate, close } = createDb(`pglite:${target}`);
  await migrate();
  await seed(db, { adminEmail: E2E_USERS.admin.email, adminPassword: E2E_USERS.admin.password });
  setDb(db);

  const fastHash = (p: string) => hash(p, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const now = Date.now();
  const DAY = 86_400_000;

  const [admin] = await db.select().from(users).where(eq(users.email, E2E_USERS.admin.email));
  await db.update(users).set({ name: "Nadia Admin", lastLoginAt: new Date(now - 3600_000) }).where(eq(users.id, admin.id));
  const [staff] = await db
    .insert(users)
    .values({ email: E2E_USERS.staff.email, name: E2E_USERS.staff.name, passwordHash: await fastHash(E2E_USERS.staff.password), role: "staff", emailVerifiedAt: new Date(), phone: "0661234567", lastLoginAt: new Date(now - 2 * 3600_000) })
    .returning();
  await db.insert(users).values({ email: E2E_USERS.staff2.email, name: E2E_USERS.staff2.name, passwordHash: await fastHash(E2E_USERS.staff2.password), role: "staff", emailVerifiedAt: new Date() });
  await db.insert(users).values({ email: E2E_USERS.customer.email, name: E2E_USERS.customer.name, passwordHash: await fastHash(E2E_USERS.customer.password), role: "customer", emailVerifiedAt: new Date(), phone: "0550998877" });

  // customers
  const customerHash = await fastHash("Customer-pass-2026!");
  const customerRows = [];
  for (let i = 0; i < 40; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    customerRows.push({
      email: `${first}.${last}${i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@example.dz",
      name: `${first} ${last}`,
      passwordHash: customerHash,
      phone: `05${String(50000000 + i * 1234567).slice(0, 8)}`,
      emailVerifiedAt: rand() < 0.8 ? new Date() : null,
      status: i === 7 ? ("disabled" as const) : ("active" as const),
      createdAt: new Date(now - Math.floor(rand() * 120) * DAY - Math.floor(rand() * DAY)),
      lastLoginAt: rand() < 0.7 ? new Date(now - Math.floor(rand() * 20) * DAY) : null,
    });
  }
  const customers = await db.insert(users).values(customerRows).returning();
  const activeCustomers = customers.filter((c) => c.status === "active");

  // plenty of stock for the order generator; realistic levels are set afterwards
  await db.update(productVariants).set({ stock: 400 });
  const variants = await db
    .select({ id: productVariants.id, productId: productVariants.productId })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(products.status, "active"));

  await createPromotion({ code: "WELCOME500", description: "500 DA off a first order over 5 000 DA", type: "fixed", value: 500, minSubtotal: 5000, perUserLimit: 1 }, { id: admin.id });
  await createPromotion({ code: "SUMMER15", description: "Summer campaign, 15% off", type: "percent", value: 15, maxDiscount: 3000, startsAt: new Date(now - 120 * DAY), endsAt: new Date(now - 60 * DAY) }, { id: admin.id });
  await createPromotion({ code: "FLASH20", description: "Paused flash sale", type: "percent", value: 20, isActive: false, usageLimit: 50 }, { id: admin.id });

  const actorFor = () => ({ id: rand() < 0.6 ? staff.id : admin.id });
  let placed = 0;
  const ORDERS = 130;
  for (let i = 0; i < ORDERS; i++) {
    const guest = rand() < 0.25;
    const customer = guest ? null : pick(activeCustomers);
    const owner = customer ? { userId: customer.id } : { guestToken: `seed-guest-${i}-${Math.floor(rand() * 1e9)}` };
    const lines = 1 + Math.floor(rand() * 3);
    const chosen = new Set<string>();
    for (let l = 0; l < lines; l++) chosen.add(pick(variants).id);
    for (const v of chosen) {
      const res = await addItem(owner, v, 1 + Math.floor(rand() * 2));
      if ("newGuestToken" in res && res.newGuestToken) (owner as { guestToken?: string }).guestToken = res.newGuestToken as string;
    }
    if (rand() < 0.15) await applyPromo(owner, "DRIVE10").catch(() => undefined);
    else if (rand() < 0.08) await applyPromo(owner, "WELCOME500").catch(() => undefined);
    const [wilaya, commune] = weighted(PLACES.map(([w, c, wt]) => [[w, c] as const, wt]));
    const name = customer?.name ?? `${pick(FIRST)} ${pick(LAST)}`;
    const result = await placeOrder(owner, {
      idempotencyKey: crypto.randomUUID(),
      contact: { name, phone: customer?.phone ?? `07${String(70000000 + i * 98765).slice(0, 8)}`, email: customer?.email ?? null },
      address: { line1: `${1 + Math.floor(rand() * 120)} ${pick(STREETS)}`, commune, wilaya, postalCode: `${wilaya}000` },
      note: rand() < 0.1 ? "Merci d’appeler avant la livraison." : null,
      locale: rand() < 0.8 ? "fr" : "ar",
    }).catch((err) => {
      console.warn("order skipped:", (err as Error).message);
      return null;
    });
    if (!result) continue;
    placed++;
    const number = result.order.number;

    // recent days are busier; a handful of orders are always "today"
    const daysAgo = i >= ORDERS - 6 ? 0 : Math.floor(Math.pow(rand(), 1.6) * 89);
    const status = daysAgo <= 1 && i >= ORDERS - 6 ? pick<OrderStatus>(["pending", "pending", "confirmed"]) : weighted(STATUS_MIX);
    const pathTo = daysAgo < 2 && ["delivered", "returned"].includes(status) ? PATH.confirmed : PATH[status];
    for (const st of pathTo) {
      const carrier = st === "shipped" ? pick(["Yalidine", "ZR Express", "Yalidine"]) : undefined;
      await changeStatusByStaff(number, st, actorFor(), carrier ? { carrier, trackingNumber: `${carrier === "Yalidine" ? "YAL" : "ZR"}-${100000 + i * 37}` } : { note: st === "cancelled" ? pick(["Client injoignable", "Commande en double", "Le client a changé d’avis"]) : null });
    }

    // back-date the order and everything that hangs off it
    const placedAt = new Date(now - daysAgo * DAY - Math.floor(rand() * (daysAgo === 0 ? 6 : 20)) * 3600_000 - 60_000);
    const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.number, number));
    await db.execute(sql`update orders set placed_at = ${placedAt}, created_at = ${placedAt},
      delivered_at = case when delivered_at is not null then ${placedAt}::timestamptz + interval '3 days' end,
      cancelled_at = case when cancelled_at is not null then ${placedAt}::timestamptz + interval '5 hours' end,
      updated_at = ${placedAt}::timestamptz + interval '3 days'
      where id = ${o.id}`);
    // spread the events between placement and now (at most 17 h apart) so the timeline stays in order
    const gapMs = Math.max(60_000, Math.min(17 * 3600_000, (now - placedAt.getTime()) / 6));
    await db.execute(sql`update order_events e set created_at = ${placedAt}::timestamptz + (x.rn - 1) * (${gapMs} * interval '1 millisecond')
      from (select id, row_number() over (order by created_at, id) as rn from order_events where order_id = ${o.id}) x
      where e.id = x.id`);
    await db.execute(sql`update inventory_movements set created_at = ${placedAt}::timestamptz + interval '1 minute' where order_id = ${o.id}`);
    await db.execute(sql`update promotion_redemptions set created_at = ${placedAt} where order_id = ${o.id}`);
  }
  // delivered_at must not be in the future
  await db.execute(sql`update orders set delivered_at = least(delivered_at, now() - interval '1 hour'), updated_at = least(updated_at, now()) `);
  await db.execute(sql`update order_events set created_at = least(created_at, now() - interval '5 minutes')`);
  await db.execute(sql`update audit_logs set created_at = coalesce((select max(e.created_at) from order_events e join orders o on o.id = e.order_id where o.number = audit_logs.entity_id), audit_logs.created_at) where entity_type = 'order'`);

  // reviews from customers who received their order
  const delivered = await db
    .select({ userId: orders.userId, slug: sql<string>`oi.product_slug` })
    .from(orders)
    .innerJoin(sql`order_items oi`, sql`oi.order_id = ${orders.id}`)
    .where(and(eq(orders.status, "delivered"), sql`${orders.userId} is not null`));
  let reviewCount = 0;
  for (const d of delivered) {
    if (rand() > 0.55) continue;
    const [rating, title, body] = weighted(REVIEW_TEXT.map((r) => [r, r[0] >= 4 ? 3 : 1] as [typeof r, number]));
    await createReview(d.userId!, d.slug, { rating, title, body })
      .then(() => reviewCount++)
      .catch(() => undefined);
  }
  const lowReviews = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.rating, 1)).limit(1);
  if (lowReviews.length) await db.update(reviews).set({ status: "hidden" }).where(inArray(reviews.id, lowReviews.map((r) => r.id)));
  await db.execute(sql`update reviews set created_at = now() - (random() * interval '40 days')`);
  await db.execute(sql`update products p set rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from reviews r where r.product_id = p.id and r.status = 'published'), 0), rating_count = (select count(*) from reviews r where r.product_id = p.id and r.status = 'published')`);

  // realistic stock levels: most variants healthy, a few low, a couple sold out
  const all = await db.select({ id: productVariants.id }).from(productVariants);
  for (const [i, v] of all.entries()) {
    const stock = i % 11 === 3 ? 0 : i % 7 === 2 ? 1 + (i % 4) : 12 + ((i * 13) % 60);
    await db.update(productVariants).set({ stock }).where(eq(productVariants.id, v.id));
  }
  await db.execute(sql`update products p set updated_at = now() - (random() * interval '30 days')`);

  // newsletter + stale guest carts (for the housekeeping tool)
  for (let i = 0; i < 24; i++) {
    await db.insert(newsletterSubscribers).values({
      email: `reader${i}@example.dz`,
      locale: i % 4 === 0 ? "ar" : "fr",
      createdAt: new Date(now - i * 3 * DAY),
      unsubscribedAt: i % 9 === 4 ? new Date(now - i * DAY) : null,
    });
  }
  await db.insert(carts).values([
    { guestTokenHash: "stale-guest-cart-1", updatedAt: new Date(now - 90 * DAY), createdAt: new Date(now - 95 * DAY) },
    { guestTokenHash: "stale-guest-cart-2", updatedAt: new Date(now - 75 * DAY), createdAt: new Date(now - 80 * DAY) },
  ]);

  const [{ n: promoUses }] = await db.select({ n: sql<number>`coalesce(sum(${promotions.usedCount}), 0)::int` }).from(promotions);
  console.log(`✓ e2e database at ${target}: ${customers.length + 3} users, ${placed} orders, ${reviewCount} reviews, ${promoUses} promo redemptions`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
