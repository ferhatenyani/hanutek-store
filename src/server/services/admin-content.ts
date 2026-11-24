import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { carriers, carts, newsletterSubscribers, products, rateLimits, reviews, users } from "../db/schema";
import { env, googleEnabled } from "../env";
import { AppError } from "../lib/errors";
import { audit, type AuditActor } from "./audit";
import { likeEscape } from "./catalog";
import { refreshRating } from "./reviews";

// ------------------------------------------------------------ reviews

export interface ReviewQuery {
  status?: "published" | "hidden";
  rating?: number;
  productId?: string;
  q?: string;
  sort?: "created" | "rating";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function adminListReviews(q: ReviewQuery) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(reviews.status, q.status));
  if (q.rating) conds.push(eq(reviews.rating, q.rating));
  if (q.productId) conds.push(eq(reviews.productId, q.productId));
  if (q.q) {
    const p = `%${likeEscape(q.q)}%`;
    conds.push(or(ilike(reviews.body, p), ilike(reviews.title, p), ilike(products.name, p), ilike(users.name, p), ilike(users.email, p))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const col = q.sort === "rating" ? reviews.rating : reviews.createdAt;
  const order = (q.dir ?? "desc") === "asc" ? asc(col) : desc(col);
  const [items, [{ total }], [counts]] = await Promise.all([
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        status: reviews.status,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        verified: sql<boolean>`${reviews.orderId} is not null`,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        userId: users.id,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(where)
      .orderBy(order, desc(reviews.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(where),
    db
      .select({
        all: sql<number>`count(*)::int`,
        published: sql<number>`(count(*) filter (where ${reviews.status} = 'published'))::int`,
        hidden: sql<number>`(count(*) filter (where ${reviews.status} = 'hidden'))::int`,
        avg: sql<string>`coalesce(round(avg(${reviews.rating}) filter (where ${reviews.status} = 'published'), 2), 0)::text`,
      })
      .from(reviews),
  ]);
  return { items, total, page, pageSize, counts: { ...counts, avg: Number(counts.avg) } };
}

/** Publish/hide many reviews in one transaction; product ratings are recomputed once per product. */
export async function bulkModerateReviews(ids: string[], status: "published" | "hidden", actor: AuditActor) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const before = await tx.select().from(reviews).where(inArray(reviews.id, ids)).orderBy(asc(reviews.id)).for("update");
    if (before.length === 0) throw new AppError("NOT_FOUND", "No matching reviews");
    await tx.update(reviews).set({ status }).where(inArray(reviews.id, before.map((r) => r.id)));
    for (const productId of new Set(before.map((r) => r.productId))) await refreshRating(tx, productId);
    for (const r of before) {
      if (r.status !== status) {
        await audit(tx, actor, "review.moderate", { type: "review", id: r.id }, { before: { status: r.status }, after: { status } });
      }
    }
    return { updated: before.length };
  });
}

// ------------------------------------------------------------ newsletter

export async function listSubscribers(q: { q?: string; status?: "subscribed" | "unsubscribed"; page?: number; pageSize?: number }) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, q.pageSize ?? 50));
  const conds: SQL[] = [];
  if (q.q) conds.push(ilike(newsletterSubscribers.email, `%${likeEscape(q.q)}%`));
  if (q.status === "subscribed") conds.push(isNull(newsletterSubscribers.unsubscribedAt));
  if (q.status === "unsubscribed") conds.push(sql`${newsletterSubscribers.unsubscribedAt} is not null`);
  const where = conds.length ? and(...conds) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db.select().from(newsletterSubscribers).where(where).orderBy(desc(newsletterSubscribers.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(newsletterSubscribers).where(where),
  ]);
  return { items, total, page, pageSize };
}

export async function subscribersCsv() {
  const db = await getDb();
  const rows = await db.select().from(newsletterSubscribers).where(isNull(newsletterSubscribers.unsubscribedAt)).orderBy(asc(newsletterSubscribers.createdAt));
  return ["email,locale,subscribed_at", ...rows.map((r) => `"${r.email.replace(/"/g, '""')}",${r.locale},${r.createdAt.toISOString()}`)].join("\r\n") + "\r\n";
}

// ------------------------------------------------------------ carriers

export interface CarrierInput {
  name: string;
  trackingUrl?: string | null;
  phone?: string | null;
  note?: string | null;
  isActive?: boolean;
  position?: number;
}

function mapCarrierUnique(err: unknown): never {
  const msg = String((err as { message?: string })?.message ?? "") + String((err as { cause?: { message?: string } })?.cause?.message ?? "");
  if (msg.includes("carriers_name_uq")) throw new AppError("CONFLICT", "A carrier with this name already exists", { fields: { name: "taken" } });
  throw err;
}

export async function listCarriers() {
  const db = await getDb();
  return db
    .select({
      id: carriers.id,
      name: carriers.name,
      trackingUrl: carriers.trackingUrl,
      phone: carriers.phone,
      note: carriers.note,
      isActive: carriers.isActive,
      position: carriers.position,
      createdAt: carriers.createdAt,
      updatedAt: carriers.updatedAt,
      inTransit: sql<number>`(select count(*)::int from orders o where lower(o.carrier) = lower("carriers"."name") and o.status in ('shipped','out_for_delivery'))`,
      delivered: sql<number>`(select count(*)::int from orders o where lower(o.carrier) = lower("carriers"."name") and o.status = 'delivered')`,
      returned: sql<number>`(select count(*)::int from orders o where lower(o.carrier) = lower("carriers"."name") and o.status = 'returned')`,
    })
    .from(carriers)
    .orderBy(asc(carriers.position), asc(carriers.name));
}

export async function createCarrier(input: CarrierInput, actor: AuditActor) {
  const db = await getDb();
  return db
    .transaction(async (tx) => {
      const [c] = await tx.insert(carriers).values(input).returning();
      await audit(tx, actor, "carrier.create", { type: "carrier", id: c.id }, { after: c });
      return c;
    })
    .catch(mapCarrierUnique);
}

export async function updateCarrier(id: string, input: Partial<CarrierInput>, actor: AuditActor) {
  const db = await getDb();
  return db
    .transaction(async (tx) => {
      const [before] = await tx.select().from(carriers).where(eq(carriers.id, id)).for("update");
      if (!before) throw new AppError("NOT_FOUND", "Carrier not found");
      const [c] = await tx.update(carriers).set(input).where(eq(carriers.id, id)).returning();
      await audit(tx, actor, "carrier.update", { type: "carrier", id }, { before, after: c });
      return c;
    })
    .catch(mapCarrierUnique);
}

/** Orders keep the carrier name as a snapshot, so deleting a carrier never touches order history. */
export async function deleteCarrier(id: string, actor: AuditActor) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.delete(carriers).where(eq(carriers.id, id)).returning();
    if (!c) throw new AppError("NOT_FOUND", "Carrier not found");
    await audit(tx, actor, "carrier.delete", { type: "carrier", id }, { before: c });
  });
}

// ------------------------------------------------------------ operations

/** Guest carts nobody touched for `days` days (they hold no stock, only clutter). */
export async function purgeGuestCarts(days: number, actor: AuditActor, dryRun = false) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const where = and(isNull(carts.userId), lt(carts.updatedAt, cutoff));
  if (dryRun) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(carts).where(where);
    return { matched: n, deleted: 0 };
  }
  return db.transaction(async (tx) => {
    const deleted = await tx.delete(carts).where(where).returning({ id: carts.id });
    await audit(tx, actor, "ops.purge_guest_carts", { type: "system" }, { after: { days, deleted: deleted.length } });
    return { matched: deleted.length, deleted: deleted.length };
  });
}

export async function clearExpiredRateLimits(actor: AuditActor) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const deleted = await tx.delete(rateLimits).where(lt(rateLimits.resetAt, new Date())).returning({ key: rateLimits.key });
    await audit(tx, actor, "ops.clear_rate_limits", { type: "system" }, { after: { deleted: deleted.length } });
    return { deleted: deleted.length };
  });
}

export async function systemStatus() {
  const db = await getDb();
  const started = performance.now();
  const [counts] = (
    (await db.execute(sql`
      select
        (select count(*)::int from users) as users,
        (select count(*)::int from products) as products,
        (select count(*)::int from orders) as orders,
        (select count(*)::int from carts where user_id is null) as "guestCarts",
        (select count(*)::int from carts where user_id is null and updated_at < now() - interval '60 days') as "staleGuestCarts",
        (select count(*)::int from refresh_sessions where revoked_at is null and rotated_at is null and expires_at > now()) as "activeSessions",
        (select count(*)::int from audit_logs) as "auditEntries",
        (select count(*)::int from rate_limits where reset_at < now()) as "expiredRateLimits"`)) as unknown as { rows: Record<string, number>[] }
  ).rows;
  const e = env();
  return {
    database: { ok: true, engine: e.DATABASE_URL.startsWith("pglite:") ? "pglite" : "postgres", latencyMs: Math.round(performance.now() - started) },
    counts,
    config: {
      environment: e.NODE_ENV,
      appUrl: e.APP_URL,
      mailDriver: e.MAIL_DRIVER,
      storageDriver: e.STORAGE_DRIVER,
      googleSignIn: googleEnabled(),
      accessTokenTtlSec: e.ACCESS_TOKEN_TTL_SEC,
      refreshTokenTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
      trustProxyHops: e.TRUST_PROXY_HOPS,
    },
  };
}
