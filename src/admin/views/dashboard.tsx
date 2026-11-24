"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Boxes, Package, ReceiptText, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi, withQuery } from "../lib/client";
import { ago, dzd, dzdCompact, fmtDay, num, pct, wilayaName } from "../lib/format";
import { ORDER_STATUS, ORDER_STATUSES, actionLabel } from "../lib/meta";
import type { Analytics, Kpis } from "../lib/types";
import { useUrlState } from "../data/state";
import { Badge, Card, CardHeader, ErrorState, Mono, PageHeader, Skeleton } from "../ui/core";
import { Segmented } from "../ui/overlay";
import { BarList, SegmentBar, Sparkline, TrendChart } from "../ui/charts";
import { useSession } from "../shell/session";

const RANGES = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "365", label: "12m" },
] as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Delta({ cur, prev, invert, label }: { cur: number; prev: number; invert?: boolean; label: string }) {
  if (!prev && !cur) return <span className="text-xs text-ad-faint">No change</span>;
  if (!prev) return <span className="text-xs text-ad-faint">New vs {label}</span>;
  const d = (cur - prev) / prev;
  const good = invert ? d < 0 : d > 0;
  const flat = Math.abs(d) < 0.005;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", flat ? "text-ad-faint" : good ? "text-ad-green" : "text-ad-red")} title={`Previous ${label}: ${prev.toLocaleString("en")}`}>
      {!flat && (d > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />)}
      {flat ? "0%" : `${Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%`}
      <span className="ms-1 font-normal text-ad-faint">vs prev.</span>
    </span>
  );
}

function Kpi({ label, value, cur, prev, invert, spark, hint }: { label: string; value: string; cur: number; prev: number; invert?: boolean; spark?: number[]; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 bg-ad-panel p-4 sm:p-5">
      <p className="text-[13px] text-ad-muted" title={hint}>
        {label}
      </p>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="tnum truncate text-[22px] font-semibold tracking-[-0.02em] text-ad-fg sm:text-2xl">{value}</p>
          <div className="mt-1">
            <Delta cur={cur} prev={prev} invert={invert} label="period" />
          </div>
        </div>
        {spark && (
          <div className="hidden shrink-0 xl:block">
            <Sparkline values={spark} width={84} />
          </div>
        )}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="space-y-3 bg-ad-panel p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function Dashboard() {
  const { user, can } = useSession();
  const { state, set } = useUrlState({ days: "30" });
  const q = useApi<Analytics>(withQuery("/admin/analytics", { days: state.days }));
  const a = q.data;
  const k: Kpis | undefined = a?.kpis;
  const p: Kpis | undefined = a?.previous;
  const label = RANGES.find((r) => r.value === state.days)?.label ?? "30d";

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${greeting()}, ${user.name.split(" ")[0]}. Here's how the store is doing.`}
        actions={<Segmented ariaLabel="Date range" value={state.days} onChange={(v) => set({ days: v })} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />}
      />

      {q.error && !a ? (
        <Card>
          <ErrorState error={q.error} onRetry={q.reload} />
        </Card>
      ) : (
        <div className={cn("space-y-4 transition-opacity", q.stale && "opacity-60")}>
          {/* KPI strip */}
          <Card padded={false} className="grid grid-cols-2 gap-px overflow-hidden bg-ad-border lg:grid-cols-4">
            {!k || !p || !a ? (
              Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
            ) : (
              <>
                <Kpi label="Gross sales" value={dzd(k.grossSales)} cur={k.grossSales} prev={p.grossSales} spark={a.series.map((s) => s.gross)} hint="Totals of non-cancelled orders placed in the period" />
                <Kpi label="Orders" value={num(k.orders)} cur={k.orders} prev={p.orders} spark={a.series.map((s) => s.orders)} />
                <Kpi label="Average order value" value={dzd(k.avgOrderValue)} cur={k.avgOrderValue} prev={p.avgOrderValue} />
                <Kpi label="New customers" value={num(k.newCustomers)} cur={k.newCustomers} prev={p.newCustomers} />
              </>
            )}
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHeader
                title="Gross sales"
                description={a ? `${dzd(k!.grossSales)} across ${num(k!.orders)} orders · last ${label}` : " "}
                actions={
                  a && (
                    <div className="hidden text-end text-xs text-ad-muted sm:block">
                      <p>
                        Collected (COD): <span className="tnum font-medium text-ad-fg">{dzd(k!.collected)}</span>
                      </p>
                      <p className="mt-0.5">
                        Units sold: <span className="tnum font-medium text-ad-fg">{num(k!.unitsSold)}</span> · Cancel rate:{" "}
                        <span className="tnum font-medium text-ad-fg">{pct(k!.cancelRate)}</span>
                      </p>
                    </div>
                  )
                }
              />
              {a ? (
                <TrendChart
                  label={`Gross sales per day, last ${label}`}
                  data={a.series.map((s) => ({ x: s.day, y: s.gross, extra: `${s.orders} order${s.orders === 1 ? "" : "s"}` }))}
                  formatY={(v) => (v === 0 ? "0" : dzdCompact(v))}
                  formatX={fmtDay}
                  height={300}
                />
              ) : (
                <Skeleton className="h-[300px] w-full" />
              )}
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Card>
                <CardHeader title="Orders by status" description="All time, current status" />
                {a ? (
                  <SegmentBar
                    segments={ORDER_STATUSES.map((s) => ({
                      key: s,
                      label: ORDER_STATUS[s].label,
                      value: a.ordersByStatus[s] ?? 0,
                      tone: ORDER_STATUS[s].tone,
                      href: `/admin/orders?status=${s}`,
                    }))}
                  />
                ) : (
                  <Skeleton className="h-24 w-full" />
                )}
              </Card>
              <Card>
                <CardHeader title="Needs attention" />
                {a ? (
                  <ul className="-mx-2 space-y-0.5 text-[13px]">
                    <AttentionRow href="/admin/orders?status=pending%2Cconfirmed%2Cpacked" icon={<ReceiptText size={15} />} label="Orders to fulfil" value={num(a.cash.toFulfil)} warn={a.cash.toFulfil > 0} />
                    <AttentionRow href="/admin/shipping" icon={<Truck size={15} />} label="Cash in transit" value={`${dzd(a.cash.inTransit)}`} sub={`${a.cash.inTransitOrders} orders`} />
                    <AttentionRow href="/admin/inventory?stock=low" icon={<Boxes size={15} />} label="Low or out of stock" value={num(a.lowStock.length)} warn={a.lowStock.length > 0} />
                  </ul>
                ) : (
                  <Skeleton className="h-24 w-full" />
                )}
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Top products" description={`By revenue · ${label}`} />
              {a ? (
                <BarList
                  items={a.topProducts.map((t) => ({ key: t.slug, label: t.name, sub: `${t.units} sold`, value: t.revenue, href: t.productId ? `/admin/products/${t.productId}` : undefined }))}
                  format={dzdCompact}
                />
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </Card>
            <Card>
              <CardHeader title="Top regions" description={`By revenue · ${label}`} />
              {a ? (
                <BarList items={a.regions.map((r) => ({ key: r.wilaya, label: wilayaName(r.wilaya), sub: `${r.orders}`, value: r.revenue, href: `/admin/orders?wilaya=${r.wilaya}` }))} format={dzdCompact} />
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </Card>
            <Card>
              <CardHeader title="Sales by category" description={`By revenue · ${label}`} />
              {a ? <BarList items={a.categories.map((c) => ({ key: c.slug, label: c.name, value: c.revenue }))} format={dzdCompact} /> : <Skeleton className="h-40 w-full" />}
            </Card>
          </div>

          <div className={cn("grid gap-4", can("audit:read") && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
            <Card padded={false}>
              <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
                <h2 className="text-sm font-semibold">Recent orders</h2>
                <Link href="/admin/orders" className="text-[13px] text-ad-muted hover:text-ad-fg">
                  View all
                </Link>
              </div>
              <ul className="mt-2 divide-y divide-ad-border">
                {!a &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <li key={i} className="px-5 py-3">
                      <Skeleton className="h-4 w-full" />
                    </li>
                  ))}
                {a?.recentOrders.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-ad-muted">No orders yet.</li>}
                {a?.recentOrders.map((o) => (
                  <li key={o.number}>
                    <Link href={`/admin/orders/${o.number}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-ad-hover sm:px-5">
                      <Mono className="w-24 shrink-0 text-ad-fg">{o.number}</Mono>
                      <span className="min-w-0 flex-1 truncate text-ad-fg">{o.name}</span>
                      <Badge tone={ORDER_STATUS[o.status].tone} dot className="max-sm:hidden">
                        {ORDER_STATUS[o.status].label}
                      </Badge>
                      <span className="tnum w-24 shrink-0 text-end font-medium">{dzd(o.total)}</span>
                      <span className="hidden w-24 shrink-0 text-end text-ad-faint md:block">{ago(o.placedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            {can("audit:read") && (
              <Card padded={false}>
                <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
                  <h2 className="text-sm font-semibold">Team activity</h2>
                  <Link href="/admin/audit" className="text-[13px] text-ad-muted hover:text-ad-fg">
                    Audit log
                  </Link>
                </div>
                <ol className="mt-2 px-4 pb-4 sm:px-5">
                  {a?.activity.length === 0 && <li className="py-8 text-center text-[13px] text-ad-muted">No activity yet.</li>}
                  {a?.activity.map((e, i) => (
                    <li key={e.id} className="relative flex gap-3 py-2 text-[13px]">
                      <span aria-hidden className="relative mt-1.5 flex flex-col items-center">
                        <span className="size-1.5 rounded-full bg-ad-faint" />
                        {i < a.activity.length - 1 && <span className="absolute top-3 h-[calc(100%+4px)] w-px bg-ad-border" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ad-fg">
                          <span className="font-medium">{e.actorName ?? "System"}</span> <span className="text-ad-muted">· {actionLabel(e.action).toLowerCase()}</span>
                        </p>
                        <p className="text-xs text-ad-faint">
                          {e.entityId ? <Mono className="text-[11.5px]">{e.entityId.length > 12 ? `${e.entityId.slice(0, 8)}…` : e.entityId}</Mono> : null} {ago(e.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </div>

          {a && a.lowStock.length > 0 && (
            <Card padded={false}>
              <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
                <h2 className="text-sm font-semibold">Low stock</h2>
                <Link href="/admin/inventory?stock=low" className="text-[13px] text-ad-muted hover:text-ad-fg">
                  Open inventory
                </Link>
              </div>
              <ul className="mt-2 grid grid-cols-1 divide-y divide-ad-border sm:grid-cols-2 sm:divide-y-0">
                {a.lowStock.map((v) => (
                  <li key={v.variantId} className="min-w-0">
                    <Link href={`/admin/inventory?search=${encodeURIComponent(v.sku)}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-ad-hover sm:px-5">
                      <Package size={15} className="shrink-0 text-ad-faint" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {v.name} <span className="text-ad-muted">· {v.label ?? v.sku}</span>
                      </span>
                      <Badge tone={v.stock === 0 ? "red" : "amber"}>{v.stock === 0 ? "Out of stock" : `${v.stock} left`}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function AttentionRow({ href, icon, label, value, sub, warn }: { href: string; icon: React.ReactNode; label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-ad-hover">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border border-ad-border", warn ? "text-ad-amber" : "text-ad-muted")}>{icon}</span>
        <span className="min-w-0 flex-1 truncate text-ad-fg">{label}</span>
        <span className="text-end">
          <span className="tnum block font-medium">{value}</span>
          {sub && <span className="block text-xs text-ad-faint">{sub}</span>}
        </span>
      </Link>
    </li>
  );
}
