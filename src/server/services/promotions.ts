import "server-only";
import { and, count, eq, or } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { promotionRedemptions, promotions } from "../db/schema";
import { AppError } from "../lib/errors";

export type Promotion = typeof promotions.$inferSelect;

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

/** Discount (whole DZD) a promotion gives on a subtotal — never more than the subtotal. */
export function computeDiscount(p: Pick<Promotion, "type" | "value" | "maxDiscount">, subtotal: number): number {
  if (subtotal <= 0) return 0;
  let d = p.type === "percent" ? Math.round((subtotal * Math.min(100, p.value)) / 100) : p.value;
  if (p.maxDiscount != null) d = Math.min(d, p.maxDiscount);
  return Math.max(0, Math.min(d, subtotal));
}

type Reason = "not_found" | "inactive" | "not_started" | "expired" | "exhausted" | "min_subtotal" | "per_user";

/**
 * Checks a promotion against the current context. Returns the reason it
 * cannot be used, or null when eligible. Per-customer limits count prior
 * redemptions by user id and (for guests) by phone number.
 */
export async function ineligibility(
  d: DbOrTx,
  p: Promotion | undefined,
  ctx: { subtotal: number; userId?: string | null; phone?: string | null },
): Promise<Reason | null> {
  if (!p) return "not_found";
  const now = Date.now();
  if (!p.isActive) return "inactive";
  if (p.startsAt && p.startsAt.getTime() > now) return "not_started";
  if (p.endsAt && p.endsAt.getTime() <= now) return "expired";
  if (p.usageLimit != null && p.usedCount >= p.usageLimit) return "exhausted";
  if (ctx.subtotal < p.minSubtotal) return "min_subtotal";
  if (p.perUserLimit != null && (ctx.userId || ctx.phone)) {
    const who = [];
    if (ctx.userId) who.push(eq(promotionRedemptions.userId, ctx.userId));
    if (ctx.phone) who.push(eq(promotionRedemptions.phone, ctx.phone));
    const [{ n }] = await d
      .select({ n: count() })
      .from(promotionRedemptions)
      .where(and(eq(promotionRedemptions.promotionId, p.id), or(...who)));
    if (n >= p.perUserLimit) return "per_user";
  }
  return null;
}

export async function findByCode(d: DbOrTx, code: string): Promise<Promotion | undefined> {
  const [p] = await d.select().from(promotions).where(eq(promotions.code, normalizeCode(code)));
  return p;
}

export async function assertEligible(d: DbOrTx, code: string, ctx: { subtotal: number; userId?: string | null; phone?: string | null }) {
  const p = await findByCode(d, code);
  const reason = await ineligibility(d, p, ctx);
  if (reason) throw new AppError("PROMO_INVALID", "This promo code cannot be applied", { reason });
  return p!;
}
