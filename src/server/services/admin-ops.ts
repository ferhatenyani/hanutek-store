import "server-only";
import { and, asc, desc, eq, getTableColumns, gte, ilike, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  addresses,
  auditLogs,
  favorites,
  orders,
  productVariants,
  products,
  promotionRedemptions,
  promotions,
  refreshSessions,
  reviews,
  users,
} from "../db/schema";
import { revokeAllForUser } from "../auth/session";
import { AppError } from "../lib/errors";
import { audit, type AuditActor } from "./audit";
import { mapUnique } from "./admin-catalog";
import { likeEscape } from "./catalog";
import { normalizeCode } from "./promotions";

// ------------------------------------------------------------ promotions

export interface PromotionInput {
  code: string;
  description?: string | null;
  type: "percent" | "fixed";
  value: number;
  minSubtotal?: number;
  maxDiscount?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  isActive?: boolean;
}

function checkPromo(input: Partial<PromotionInput>) {
  if (input.type === "percent" && input.value !== undefined && (input.value < 1 || input.value > 100)) {
    throw new AppError("VALIDATION", "Percent must be between 1 and 100", { fields: { value: "range" } });
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
    throw new AppError("VALIDATION", "End must be after start", { fields: { endsAt: "before_start" } });
  }
}

const promoStats = {
  revenue: sql<number>`(select coalesce(sum(o.total), 0)::int from orders o where o.promotion_id = "promotions"."id" and o.status <> 'cancelled')`,
  discountGiven: sql<number>`(select coalesce(sum(o.discount), 0)::int from orders o where o.promotion_id = "promotions"."id" and o.status <> 'cancelled')`,
  orderCount: sql<number>`(select count(*)::int from orders o where o.promotion_id = "promotions"."id" and o.status <> 'cancelled')`,
};

export async function listPromotions() {
  const db = await getDb();
  return db
    .select({ ...getTableColumns(promotions), ...promoStats })
    .from(promotions)
    .orderBy(desc(promotions.createdAt));
}

export async function getPromotion(id: string) {
  const db = await getDb();
  const [p] = await db.select({ ...getTableColumns(promotions), ...promoStats }).from(promotions).where(eq(promotions.id, id));
  if (!p) throw new AppError("NOT_FOUND", "Promotion not found");
  const redemptions = await db
    .select({
      id: promotionRedemptions.id,
      createdAt: promotionRedemptions.createdAt,
      phone: promotionRedemptions.phone,
      orderNumber: orders.number,
      orderStatus: orders.status,
      total: orders.total,
      discount: orders.discount,
      customerName: orders.contactName,
      userId: promotionRedemptions.userId,
    })
    .from(promotionRedemptions)
    .innerJoin(orders, eq(orders.id, promotionRedemptions.orderId))
    .where(eq(promotionRedemptions.promotionId, id))
    .orderBy(desc(promotionRedemptions.createdAt))
    .limit(100);
  return { ...p, redemptions };
}

/** Codes that were never used can be deleted; used codes are kept for order history and should be deactivated. */
export async function deletePromotion(id: string, actor: AuditActor) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(promotions).where(eq(promotions.id, id)).for("update");
    if (!p) throw new AppError("NOT_FOUND", "Promotion not found");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.promotionId, id));
    if (p.usedCount > 0 || n > 0) {
      throw new AppError("CONFLICT", "This code has been used on orders. Deactivate it instead.", { reason: "used" });
    }
    await tx.delete(promotions).where(eq(promotions.id, id));
    await audit(tx, actor, "promotion.delete", { type: "promotion", id }, { before: p });
  });
}

export async function createPromotion(input: PromotionInput, actor: AuditActor) {
  checkPromo(input);
  const db = await getDb();
  return db
    .transaction(async (tx) => {
      const [p] = await tx.insert(promotions).values({ ...input, code: normalizeCode(input.code) }).returning();
      await audit(tx, actor, "promotion.create", { type: "promotion", id: p.id }, { after: p });
      return p;
    })
    .catch(mapUnique);
}

export async function updatePromotion(id: string, input: Partial<PromotionInput>, actor: AuditActor) {
  checkPromo(input);
  const db = await getDb();
  return db
    .transaction(async (tx) => {
      const [before] = await tx.select().from(promotions).where(eq(promotions.id, id)).for("update");
      if (!before) throw new AppError("NOT_FOUND", "Promotion not found");
      // validate the merged result (e.g. a value-only patch on a percent code)
      checkPromo({ ...before, ...input });
      const patch = { ...input, ...(input.code ? { code: normalizeCode(input.code) } : {}) };
      const [p] = await tx.update(promotions).set(patch).where(eq(promotions.id, id)).returning();
      await audit(tx, actor, "promotion.update", { type: "promotion", id }, { before, after: p });
      return p;
    })
    .catch(mapUnique);
}

// ------------------------------------------------------------ customers

const publicUser = {
  id: users.id,
  email: users.email,
  name: users.name,
  phone: users.phone,
  role: users.role,
  status: users.status,
  emailVerifiedAt: users.emailVerifiedAt,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

export interface CustomerQuery {
  search?: string;
  role?: "customer" | "staff" | "admin";
  /** "team" = staff + admin */
  scope?: "team";
  status?: "active" | "disabled";
  verified?: "yes" | "no";
  sort?: "created" | "name" | "orders" | "spent" | "lastLogin";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

const orderCountSql = sql<number>`(select count(*)::int from orders o where o.user_id = "users"."id")`;
const totalSpentSql = sql<number>`(select coalesce(sum(o.total), 0)::int from orders o where o.user_id = "users"."id" and o.status = 'delivered')`;

export async function listCustomers(q: CustomerQuery) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
  const conds: SQL[] = [];
  if (q.role) conds.push(eq(users.role, q.role));
  if (q.scope === "team") conds.push(inArray(users.role, ["staff", "admin"]));
  if (q.status) conds.push(eq(users.status, q.status));
  if (q.verified === "yes") conds.push(isNotNull(users.emailVerifiedAt));
  if (q.verified === "no") conds.push(isNull(users.emailVerifiedAt));
  if (q.search) {
    const p = `%${likeEscape(q.search)}%`;
    conds.push(or(ilike(users.email, p), ilike(users.name, p), ilike(users.phone, p))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const col = { created: users.createdAt, name: users.name, orders: orderCountSql, spent: totalSpentSql, lastLogin: users.lastLoginAt }[q.sort ?? "created"];
  const dir = q.dir ?? (q.sort === "name" ? "asc" : "desc");
  const order = dir === "asc" ? sql`${col} asc nulls last` : sql`${col} desc nulls last`;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        ...publicUser,
        orderCount: orderCountSql,
        totalSpent: totalSpentSql,
        lastOrderAt: sql<string | null>`(select max(o.placed_at) from orders o where o.user_id = "users"."id")`,
      })
      .from(users)
      .where(where)
      .orderBy(order, asc(users.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return {
    items: rows.map((r) => ({ ...r, lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt).toISOString() : null })),
    total,
    page,
    pageSize,
  };
}

export async function getCustomer(id: string) {
  const db = await getDb();
  const [u] = await db.select({ ...publicUser, locale: users.locale, googleLinked: sql<boolean>`${users.googleSub} is not null` }).from(users).where(eq(users.id, id));
  if (!u) throw new AppError("NOT_FOUND", "Customer not found");
  const [recent, addressRows, reviewRows, [stats], [sessions], activity] = await Promise.all([
    db
      .select({ number: orders.number, status: orders.status, paymentStatus: orders.paymentStatus, total: orders.total, placedAt: orders.placedAt })
      .from(orders)
      .where(eq(orders.userId, id))
      .orderBy(desc(orders.placedAt))
      .limit(50),
    db.select().from(addresses).where(eq(addresses.userId, id)).orderBy(desc(addresses.isDefault), desc(addresses.updatedAt)),
    db
      .select({ id: reviews.id, rating: reviews.rating, title: reviews.title, body: reviews.body, status: reviews.status, createdAt: reviews.createdAt, productName: products.name, productId: products.id })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .where(eq(reviews.userId, id))
      .orderBy(desc(reviews.createdAt))
      .limit(20),
    db
      .select({
        orderCount: sql<number>`count(*)::int`,
        delivered: sql<number>`(count(*) filter (where ${orders.status} = 'delivered'))::int`,
        cancelled: sql<number>`(count(*) filter (where ${orders.status} = 'cancelled'))::int`,
        totalSpent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'delivered'), 0)::int`,
        firstOrderAt: sql<string | null>`min(${orders.placedAt})`,
        lastOrderAt: sql<string | null>`max(${orders.placedAt})`,
      })
      .from(orders)
      .where(eq(orders.userId, id)),
    db
      .select({ active: sql<number>`count(*)::int` })
      .from(refreshSessions)
      .where(and(eq(refreshSessions.userId, id), isNull(refreshSessions.revokedAt), isNull(refreshSessions.rotatedAt), gte(refreshSessions.expiresAt, new Date()))),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actorName: users.name, after: auditLogs.after })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(and(eq(auditLogs.entityType, "user"), eq(auditLogs.entityId, id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20),
  ]);
  const favoriteCount = await db.select({ n: sql<number>`count(*)::int` }).from(favorites).where(eq(favorites.userId, id));
  const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
  return {
    ...u,
    orders: recent,
    addresses: addressRows,
    reviews: reviewRows,
    stats: {
      ...stats,
      firstOrderAt: iso(stats.firstOrderAt),
      lastOrderAt: iso(stats.lastOrderAt),
      avgOrderValue: stats.delivered ? Math.round(stats.totalSpent / stats.delivered) : 0,
      favorites: favoriteCount[0]?.n ?? 0,
      activeSessions: sessions.active,
    },
    activity,
  };
}

/** Signs a user out everywhere (refresh sessions revoked + access tokens invalidated). */
export async function revokeCustomerSessions(id: string, actor: AuditActor & { role: string }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [u] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id)).for("update");
    if (!u) throw new AppError("NOT_FOUND", "Customer not found");
    if (u.role === "admin" && actor.role !== "admin") throw new AppError("FORBIDDEN", "Insufficient permissions");
    await revokeAllForUser(tx, id);
    await audit(tx, actor, "customer.revoke_sessions", { type: "user", id });
  });
}

/** Disabling (or changing role) revokes every session immediately — tokens carry the old tokenVersion. */
export async function updateCustomer(
  id: string,
  patch: { status?: "active" | "disabled"; role?: "customer" | "staff" | "admin" },
  actor: AuditActor & { role: string },
) {
  if (patch.role !== undefined && actor.role !== "admin") throw new AppError("FORBIDDEN", "Only admins can change roles");
  if (id === actor.id && (patch.status === "disabled" || (patch.role && patch.role !== "admin"))) {
    throw new AppError("CONFLICT", "You cannot disable or demote your own account");
  }
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [before] = await tx.select(publicUser).from(users).where(eq(users.id, id)).for("update");
    if (!before) throw new AppError("NOT_FOUND", "Customer not found");
    // Staff can't act on admins.
    if (before.role === "admin" && actor.role !== "admin") throw new AppError("FORBIDDEN", "Insufficient permissions");
    await tx.update(users).set(patch).where(eq(users.id, id));
    if ((patch.status && patch.status !== before.status) || (patch.role && patch.role !== before.role)) {
      await revokeAllForUser(tx, id);
    }
    await audit(tx, actor, "customer.update", { type: "user", id }, { before: { status: before.status, role: before.role }, after: patch });
    const [after] = await tx.select(publicUser).from(users).where(eq(users.id, id));
    return after;
  });
}

// ------------------------------------------------------------ audit & stats

export async function listAudit(q: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  q?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 50));
  const conds: SQL[] = [];
  if (q.entityType) conds.push(eq(auditLogs.entityType, q.entityType));
  if (q.entityId) conds.push(eq(auditLogs.entityId, q.entityId));
  if (q.actorId) conds.push(eq(auditLogs.actorId, q.actorId));
  if (q.action) conds.push(ilike(auditLogs.action, `${likeEscape(q.action)}%`));
  if (q.from) conds.push(gte(auditLogs.createdAt, q.from));
  if (q.to) conds.push(lte(auditLogs.createdAt, q.to));
  if (q.q) {
    const p = `%${likeEscape(q.q)}%`;
    conds.push(or(ilike(auditLogs.action, p), ilike(auditLogs.entityId, p), ilike(users.name, p), ilike(users.email, p))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [items, [{ total }], actions] = await Promise.all([
    db
      .select({ ...getTableColumns(auditLogs), actorName: users.name, actorEmail: users.email, actorRole: users.role })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(where),
    db.selectDistinct({ entityType: auditLogs.entityType }).from(auditLogs).orderBy(asc(auditLogs.entityType)),
  ]);
  return { items, total, page, pageSize, entityTypes: actions.map((a) => a.entityType) };
}

export async function dashboardStats() {
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 86400_000);
  const [byStatus, [recent], [lowStock]] = await Promise.all([
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db
      .select({
        orders: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'delivered'), 0)::int`,
      })
      .from(orders)
      .where(gte(orders.placedAt, since)),
    db.select({ n: sql<number>`count(*)::int` }).from(productVariants).where(and(eq(productVariants.isActive, true), sql`${productVariants.stock} <= 3`)),
  ]);
  return {
    ordersByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    last30Days: recent,
    lowStockVariants: lowStock.n,
  };
}
