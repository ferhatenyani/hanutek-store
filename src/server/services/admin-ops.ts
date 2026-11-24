import "server-only";
import { and, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { auditLogs, orders, productVariants, promotions, users } from "../db/schema";
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

export async function listPromotions() {
  const db = await getDb();
  return db.select().from(promotions).orderBy(desc(promotions.createdAt));
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

export async function listCustomers(q: { search?: string; role?: "customer" | "staff" | "admin"; page?: number; pageSize?: number }) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
  const conds: SQL[] = [];
  if (q.role) conds.push(eq(users.role, q.role));
  if (q.search) {
    const p = `%${likeEscape(q.search)}%`;
    conds.push(or(ilike(users.email, p), ilike(users.name, p), ilike(users.phone, p))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select({
      ...publicUser,
      orderCount: sql<number>`(select count(*)::int from orders o where o.user_id = ${users.id})`,
      totalSpent: sql<number>`(select coalesce(sum(o.total), 0)::int from orders o where o.user_id = ${users.id} and o.status = 'delivered')`,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(users).where(where);
  return { items: rows, total, page, pageSize };
}

export async function getCustomer(id: string) {
  const db = await getDb();
  const [u] = await db.select(publicUser).from(users).where(eq(users.id, id));
  if (!u) throw new AppError("NOT_FOUND", "Customer not found");
  const recent = await db
    .select({ number: orders.number, status: orders.status, total: orders.total, placedAt: orders.placedAt })
    .from(orders)
    .where(eq(orders.userId, id))
    .orderBy(desc(orders.placedAt))
    .limit(20);
  return { ...u, orders: recent };
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

export async function listAudit(q: { entityType?: string; entityId?: string; actorId?: string; page?: number; pageSize?: number }) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 50));
  const conds: SQL[] = [];
  if (q.entityType) conds.push(eq(auditLogs.entityType, q.entityType));
  if (q.entityId) conds.push(eq(auditLogs.entityId, q.entityId));
  if (q.actorId) conds.push(eq(auditLogs.actorId, q.actorId));
  const where = conds.length ? and(...conds) : undefined;
  const items = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  return { items, page, pageSize };
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
