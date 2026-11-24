import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { AppError } from "./errors";

/**
 * Fixed-window rate limiter backed by Postgres (one atomic UPSERT per hit).
 * Shared across every app instance without extra infrastructure; the table
 * is tiny and self-pruning. Swap for Redis if traffic ever demands it.
 */
export interface Limit {
  /** Bucket name, e.g. "login:ip". */
  name: string;
  max: number;
  windowSec: number;
}

export const LIMITS = {
  loginIp: { name: "login:ip", max: 20, windowSec: 15 * 60 },
  loginEmail: { name: "login:email", max: 8, windowSec: 15 * 60 },
  register: { name: "register:ip", max: 10, windowSec: 60 * 60 },
  emailSend: { name: "email:send", max: 5, windowSec: 60 * 60 },
  passwordReset: { name: "pwreset:ip", max: 10, windowSec: 60 * 60 },
  refresh: { name: "refresh:ip", max: 120, windowSec: 15 * 60 },
  checkout: { name: "checkout:ip", max: 10, windowSec: 10 * 60 },
  promo: { name: "promo:ip", max: 20, windowSec: 10 * 60 },
  cartWrite: { name: "cart:ip", max: 300, windowSec: 10 * 60 },
  review: { name: "review:user", max: 10, windowSec: 60 * 60 },
  search: { name: "search:ip", max: 300, windowSec: 5 * 60 },
  orderLookup: { name: "order:ip", max: 60, windowSec: 10 * 60 },
  upload: { name: "upload:user", max: 60, windowSec: 10 * 60 },
} satisfies Record<string, Limit>;

export async function hit(limit: Limit, subject: string): Promise<{ ok: boolean; remaining: number; retryAfter: number }> {
  if (process.env.RATE_LIMIT_DISABLED === "1") return { ok: true, remaining: limit.max, retryAfter: 0 };
  const db = await getDb();
  const key = `${limit.name}:${subject}`.slice(0, 300);
  const res = await db.execute<{ count: number; reset_at: Date | string }>(sql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + make_interval(secs => ${limit.windowSec}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end
    returning count, reset_at`);
  const row = res.rows[0];
  const count = Number(row.count);
  const retryAfter = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
  // Opportunistic pruning keeps the table small.
  if (Math.random() < 0.01) await db.execute(sql`delete from rate_limits where reset_at < now() - interval '1 hour'`);
  return { ok: count <= limit.max, remaining: Math.max(0, limit.max - count), retryAfter };
}

/** Throws RATE_LIMITED when the bucket is exhausted. */
export async function enforce(limit: Limit, subject: string) {
  const r = await hit(limit, subject);
  if (!r.ok) throw new AppError("RATE_LIMITED", "Too many requests, try again later", { retryAfter: r.retryAfter });
}
