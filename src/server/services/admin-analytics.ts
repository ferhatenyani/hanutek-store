import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";

/*
 * Dashboard analytics. All figures are computed from the order snapshots
 * (never from the live catalogue) so historic numbers do not drift when
 * prices change. Days are bucketed in Algeria time (UTC+1, no DST).
 *
 *  - gross sales: totals of orders placed in the period, excluding cancelled
 *  - collected:   totals of orders delivered in the period (COD cash received)
 */

const TZ_SHIFT = sql.raw(`interval '1 hour'`);
const DAY_MS = 86_400_000;

type Row = Record<string, unknown>;
const rows = async <T extends Row>(q: ReturnType<typeof sql>) => {
  const db = await getDb();
  const res = (await db.execute(q)) as unknown as { rows: T[] } | T[];
  return Array.isArray(res) ? res : res.rows;
};

/** Start of the local (UTC+1) day `daysAgo` days before today, as a UTC instant. */
export function localDayStart(daysAgo: number, now = Date.now()) {
  const local = new Date(now + 3600_000);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - daysAgo * DAY_MS;
  return new Date(startLocal - 3600_000);
}

async function periodKpis(from: Date, to: Date) {
  const [o] = await rows<{ orders: number; gross: number; kept: number; cancelled: number; units: number }>(sql`
    select
      count(*)::int as orders,
      coalesce(sum(total) filter (where status <> 'cancelled'), 0)::int as gross,
      count(*) filter (where status <> 'cancelled')::int as kept,
      count(*) filter (where status = 'cancelled')::int as cancelled,
      coalesce((select sum(oi.qty) from order_items oi join orders o2 on o2.id = oi.order_id
        where o2.placed_at >= ${from} and o2.placed_at < ${to} and o2.status <> 'cancelled'), 0)::int as units
    from orders where placed_at >= ${from} and placed_at < ${to}`);
  const [c] = await rows<{ collected: number }>(sql`
    select coalesce(sum(total), 0)::int as collected from orders
    where status = 'delivered' and delivered_at >= ${from} and delivered_at < ${to}`);
  const [u] = await rows<{ customers: number }>(sql`
    select count(*)::int as customers from users where role = 'customer' and created_at >= ${from} and created_at < ${to}`);
  return {
    orders: o.orders,
    grossSales: o.gross,
    collected: c.collected,
    avgOrderValue: o.kept ? Math.round(o.gross / o.kept) : 0,
    cancelRate: o.orders ? o.cancelled / o.orders : 0,
    unitsSold: o.units,
    newCustomers: u.customers,
  };
}

export async function analytics(days: number, opts: { includeActivity?: boolean } = {}) {
  const now = new Date();
  const from = localDayStart(days - 1);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);

  const [current, previous, series, top, regions, categories, lowStock, statusCounts, recent, activity, cash] = await Promise.all([
    periodKpis(from, now),
    periodKpis(prevFrom, from),
    rows<{ day: string; orders: number; gross: number }>(sql`
      select to_char(d.day, 'YYYY-MM-DD') as day,
        count(o.id)::int as orders,
        coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::int as gross
      from generate_series((${from}::timestamptz + ${TZ_SHIFT})::date, (${now}::timestamptz + ${TZ_SHIFT})::date, interval '1 day') as d(day)
      left join orders o on (o.placed_at + ${TZ_SHIFT})::date = d.day::date
      group by d.day order by d.day`),
    rows<{ productId: string | null; slug: string; name: string; units: number; revenue: number }>(sql`
      select oi.product_id as "productId", oi.product_slug as slug, max(oi.product_name) as name,
        sum(oi.qty)::int as units, sum(oi.line_total)::int as revenue
      from order_items oi join orders o on o.id = oi.order_id
      where o.placed_at >= ${from} and o.status <> 'cancelled'
      group by oi.product_id, oi.product_slug order by revenue desc limit 6`),
    rows<{ wilaya: string; orders: number; revenue: number }>(sql`
      select ship_wilaya as wilaya, count(*)::int as orders, coalesce(sum(total), 0)::int as revenue
      from orders where placed_at >= ${from} and status <> 'cancelled'
      group by ship_wilaya order by revenue desc limit 6`),
    rows<{ slug: string; name: string; revenue: number }>(sql`
      select c.slug, coalesce(ct.name, c.slug) as name, coalesce(sum(oi.line_total), 0)::int as revenue
      from order_items oi
      join orders o on o.id = oi.order_id
      join products p on p.id = oi.product_id
      join categories c on c.id = p.category_id
      left join category_translations ct on ct.category_id = c.id and ct.locale = 'fr'
      where o.placed_at >= ${from} and o.status <> 'cancelled'
      group by c.slug, ct.name order by revenue desc`),
    rows<{ variantId: string; productId: string; name: string; sku: string; label: string | null; stock: number }>(sql`
      select v.id as "variantId", p.id as "productId", p.name, v.sku, vt.label, v.stock
      from product_variants v join products p on p.id = v.product_id
      left join variant_translations vt on vt.variant_id = v.id and vt.locale = 'fr'
      where v.is_active and p.status = 'active' and v.stock <= 5
      order by v.stock asc, p.name asc limit 8`),
    rows<{ status: string; n: number }>(sql`select status, count(*)::int as n from orders group by status`),
    rows<{ number: string; status: string; total: number; name: string; placedAt: string }>(sql`
      select number, status, total, contact_name as name, placed_at as "placedAt" from orders order by placed_at desc limit 6`),
    !opts.includeActivity ? Promise.resolve([]) : rows<{ id: string; action: string; entityType: string; entityId: string | null; createdAt: string; actorName: string | null }>(sql`
      select a.id, a.action, a.entity_type as "entityType", a.entity_id as "entityId", a.created_at as "createdAt", u.name as "actorName"
      from audit_logs a left join users u on u.id = a.actor_id order by a.created_at desc limit 8`),
    rows<{ inTransit: number; inTransitOrders: number; toFulfil: number }>(sql`
      select
        coalesce(sum(total) filter (where status in ('shipped','out_for_delivery')), 0)::int as "inTransit",
        count(*) filter (where status in ('shipped','out_for_delivery'))::int as "inTransitOrders",
        count(*) filter (where status in ('pending','confirmed','packed'))::int as "toFulfil"
      from orders`),
  ]);

  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
  return {
    range: { days, from: from.toISOString(), to: now.toISOString() },
    kpis: current,
    previous,
    series,
    topProducts: top,
    regions,
    categories,
    lowStock,
    ordersByStatus: Object.fromEntries(statusCounts.map((r) => [r.status, r.n])),
    recentOrders: recent.map((r) => ({ ...r, placedAt: iso(r.placedAt) })),
    activity: activity.map((a) => ({ ...a, createdAt: iso(a.createdAt) })),
    cash: cash[0],
  };
}
