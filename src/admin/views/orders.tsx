"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, ListChecks, ReceiptText } from "lucide-react";
import type { OrderStatus } from "@/lib/api-types";
import { WILAYAS } from "@/lib/wilayas";
import { adminApi, errorMessage, invalidate, useApi, withQuery } from "../lib/client";
import { ago, downloadUrl, dzd, fmtDateTime, wilayaName } from "../lib/format";
import { ORDER_STATUS, ORDER_STATUSES, PAYMENT_STATUS, TRANSITION_VERB } from "../lib/meta";
import type { OrderRow, Paged } from "../lib/types";
import { useUrlState } from "../data/state";
import { DataTable, Pagination, SelectionBar, nextSort, useColumns, type Column, type Sort } from "../data/table";
import { FilterSelect, ResetFilters, SavedViews, SearchBox, Toolbar } from "../data/toolbar";
import { Badge, Button, Card, EmptyState, Field, Mono, PageHeader, Textarea } from "../ui/core";
import { Dialog, Menu, Select, Tabs, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";

const TABS = [
  { value: "", label: "All" },
  { value: "pending,confirmed", label: "To confirm" },
  { value: "packed", label: "To ship" },
  { value: "shipped,out_for_delivery", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled,returned", label: "Cancelled & returned" },
] as const;

const RANGES = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const startOfDaysAgo = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
};

function toCsv(rows: OrderRow[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const head = ["number", "placed_at", "status", "payment", "customer", "phone", "wilaya", "items", "total", "carrier", "tracking"];
  const body = rows.map((o) => [o.number, o.placedAt, o.status, o.paymentStatus, o.customer.name, o.customer.phone, o.wilaya, o.itemCount, o.total, o.carrier, o.trackingNumber].map(esc).join(","));
  return [head.join(","), ...body].join("\r\n");
}

export function OrdersPage() {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const { state, set, reset, activeCount, search } = useUrlState({ status: "", q: "", payment: "", wilaya: "", range: "", sort: "placed", dir: "desc", page: "1", pageSize: "25" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<OrderStatus | null>(null);

  const query = withQuery("/admin/orders", {
    status: state.status,
    q: state.q,
    paymentStatus: state.payment,
    wilaya: state.wilaya,
    from: state.range ? startOfDaysAgo(Number(state.range)) : "",
    sort: state.sort,
    dir: state.dir,
    page: state.page,
    pageSize: state.pageSize,
  });
  const q = useApi<Paged<OrderRow>>(query);
  const sort: Sort = { key: state.sort, dir: state.dir as Sort["dir"] };

  const columns = useMemo<Column<OrderRow>[]>(
    () => [
      {
        id: "number",
        header: "Order",
        primary: true,
        hideable: false,
        width: "120px",
        cell: (o) => (
          <span className="flex items-center gap-2">
            <Mono className="font-medium text-ad-fg">{o.number}</Mono>
            <Badge tone={ORDER_STATUS[o.status].tone} dot className="md:hidden">
              {ORDER_STATUS[o.status].label}
            </Badge>
          </span>
        ),
      },
      { id: "date", header: "Date", sortKey: "placed", mobile: true, width: "130px", cell: (o) => <span className="whitespace-nowrap text-ad-muted" title={fmtDateTime(o.placedAt)}>{ago(o.placedAt)}</span> },
      {
        id: "customer",
        header: "Customer",
        mobile: true,
        cell: (o) => (
          <span className="block min-w-0 max-w-[220px]">
            <span className="block truncate text-ad-fg">{o.customer.name}</span>
            <span className="block truncate text-xs text-ad-muted max-md:hidden">{o.customer.phone}</span>
          </span>
        ),
      },
      { id: "status", header: "Status", width: "140px", cell: (o) => <Badge tone={ORDER_STATUS[o.status].tone} dot>{ORDER_STATUS[o.status].label}</Badge> },
      { id: "payment", header: "Payment", width: "110px", cell: (o) => <Badge tone={PAYMENT_STATUS[o.paymentStatus].tone}>{PAYMENT_STATUS[o.paymentStatus].label}</Badge> },
      { id: "items", header: "Items", align: "end", width: "70px", cell: (o) => o.itemCount },
      { id: "region", header: "Region", cell: (o) => <span className="whitespace-nowrap text-ad-muted">{wilayaName(o.wilaya)}</span> },
      { id: "carrier", header: "Carrier", defaultHidden: true, cell: (o) => (o.carrier ? <span className="text-ad-muted">{o.carrier}</span> : <span className="text-ad-faint">—</span>) },
      { id: "promo", header: "Promo", defaultHidden: true, cell: (o) => (o.promoCode ? <Mono className="text-ad-muted">{o.promoCode}</Mono> : <span className="text-ad-faint">—</span>) },
      { id: "total", header: "Total", sortKey: "total", align: "end", mobile: true, width: "120px", cell: (o) => <span className="font-medium whitespace-nowrap">{dzd(o.total)}</span> },
    ],
    [],
  );
  const cols = useColumns("orders", columns);

  const onSort = useCallback((key: string) => {
    const n = nextSort(sort, key);
    set({ sort: n.key, dir: n.dir });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sort, state.dir]);
  const setQ = useCallback((v: string) => set({ q: v }), [set]);

  const rows = q.data?.items;
  const selectedRows = (rows ?? []).filter((r) => selected.has(r.number));

  return (
    <>
      <PageHeader
        title="Orders"
        description="Cash on delivery orders, from confirmation to collection."
        actions={
          <Button onClick={() => downloadUrl(withQuery("/api/v1/admin/orders/export", { status: state.status, q: state.q, paymentStatus: state.payment, wilaya: state.wilaya, from: state.range ? startOfDaysAgo(Number(state.range)) : "" }))}>
            <Download size={14} /> Export CSV
          </Button>
        }
      />
      <Card padded={false}>
        <div className="px-4 pt-1">
          <Tabs value={state.status} onChange={(v) => set({ status: v })} tabs={TABS.map((t) => ({ value: t.value, label: t.label }))} />
        </div>
        {selected.size > 0 ? (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} totalOnPage={rows?.length}>
            {can("orders:write") && (
              <Menu
                align="end"
                label="Change status"
                items={ORDER_STATUSES.filter((s) => s !== "pending").map((s) => ({ label: TRANSITION_VERB[s], onSelect: () => setBulk(s), danger: s === "cancelled" || s === "returned" }))}
                trigger={(p) => (
                  <Button {...p} size="sm" variant="primary">
                    <ListChecks size={14} /> Change status
                  </Button>
                )}
              />
            )}
            <Button
              size="sm"
              onClick={() => {
                const blob = new Blob([toCsv(selectedRows)], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                downloadUrl(url);
                setTimeout(() => URL.revokeObjectURL(url), 2000);
              }}
              disabled={!selectedRows.length}
            >
              <Download size={14} /> Export selected
            </Button>
          </SelectionBar>
        ) : (
          <Toolbar>
            <SearchBox value={state.q} onChange={setQ} placeholder="Number, name, phone, tracking…" label="Search orders" />
            <FilterSelect label="Payment" value={state.payment as "" | "unpaid"} onChange={(v) => set({ payment: v })} options={Object.entries(PAYMENT_STATUS).map(([value, m]) => ({ value: value as "unpaid", label: m.label, text: m.label }))} />
            <FilterSelect
              label="Date"
              allLabel="Any time"
              width="w-[170px]"
              value={state.range as "" | "7"}
              onChange={(v) => set({ range: v })}
              options={RANGES.map((r) => ({ value: r.value as "7", label: r.label, text: r.label }))}
            />
            <div className="w-[190px]">
              <Select
                size="sm"
                ariaLabel="Region"
                prefix="Region"
                value={state.wilaya}
                onChange={(v) => set({ wilaya: v })}
                options={[{ value: "", label: "All", text: "All" }, ...WILAYAS.map((w) => ({ value: w.code, label: `${w.code} · ${w.fr}`, text: `${w.code} ${w.fr}` }))]}
                className={state.wilaya ? "border-ad-border-strong" : undefined}
              />
            </div>
            <ResetFilters count={activeCount + (state.q ? 1 : 0)} onReset={reset} />
            <div className="ms-auto flex items-center gap-2">
              <SavedViews tableId="orders" current={search} onApply={(qs) => window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)} />
              {cols.menu}
            </div>
          </Toolbar>
        )}
        <DataTable
          label="Orders"
          rows={rows}
          rowId={(o) => o.number}
          columns={cols.visible}
          loading={q.loading}
          stale={q.stale}
          error={q.error}
          onRetry={q.reload}
          sort={sort}
          onSort={onSort}
          selected={selected}
          onSelectedChange={setSelected}
          rowHref={(o) => `/admin/orders/${o.number}`}
          rowActions={(o) => [
            { label: "Open order", icon: <ReceiptText size={14} />, onSelect: () => router.push(`/admin/orders/${o.number}`) },
            { label: "Copy number", icon: <Copy size={14} />, onSelect: () => void navigator.clipboard?.writeText(o.number).then(() => toast("Order number copied")) },
            ...(o.customer.userId && can("customers:read") ? [{ label: "View customer", icon: <ExternalLink size={14} />, onSelect: () => router.push(`/admin/customers/${o.customer.userId}`) }] : []),
          ]}
          empty={
            <EmptyState
              icon={<ReceiptText size={18} />}
              title={activeCount || state.q || state.status ? "No orders match these filters" : "No orders yet"}
              description={activeCount || state.q || state.status ? "Try another status tab or clear the filters." : "Orders placed on the store appear here."}
              action={activeCount || state.q || state.status ? <Button size="sm" onClick={reset}>Clear filters</Button> : undefined}
            />
          }
        />
        <Pagination page={Number(state.page)} pageSize={Number(state.pageSize)} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} onPageSize={(s) => set({ pageSize: String(s) })} />
      </Card>
      <BulkStatusDialog
        status={bulk}
        numbers={[...selected]}
        onClose={() => setBulk(null)}
        onDone={(failed) => {
          setBulk(null);
          setSelected(new Set(failed));
        }}
      />
    </>
  );
}

function BulkStatusDialog({ status, numbers, onClose, onDone }: { status: OrderStatus | null; numbers: string[]; onClose: () => void; onDone: (failed: string[]) => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [failures, setFailures] = useState<{ number: string; message?: string }[] | null>(null);
  if (!status) return null;
  const run = async () => {
    setPending(true);
    try {
      const r = await adminApi<{ updated: number; failed: number; results: { number: string; ok: boolean; message?: string }[] }>("/admin/orders/bulk-status", {
        method: "POST",
        body: { numbers, status, note: note.trim() || null },
      });
      invalidate("/admin/orders", "/admin/analytics", "/admin/inventory");
      if (r.failed === 0) {
        toast.success(`${r.updated} order${r.updated === 1 ? "" : "s"} updated`, `Moved to ${ORDER_STATUS[status].label.toLowerCase()}.`);
        setNote("");
        onDone([]);
      } else {
        toast(`${r.updated} updated, ${r.failed} skipped`, { tone: r.updated ? "info" : "error", description: "Some orders can't move to this status from where they are." });
        setFailures(r.results.filter((x) => !x.ok));
      }
    } catch (err) {
      toast.error("Couldn't update orders", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  const close = () => {
    const f = failures;
    setFailures(null);
    setNote("");
    if (f) onDone(f.map((x) => x.number));
    else onClose();
  };
  return (
    <Dialog
      open
      onClose={close}
      title={failures ? "Some orders were skipped" : `${TRANSITION_VERB[status]} · ${numbers.length} order${numbers.length === 1 ? "" : "s"}`}
      description={failures ? "These orders kept their current status. They stay selected so you can review them." : ORDER_STATUS[status].hint}
      footer={
        failures ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant={status === "cancelled" || status === "returned" ? "danger" : "primary"} loading={pending} onClick={run}>
              {TRANSITION_VERB[status]}
            </Button>
          </>
        )
      }
    >
      {failures ? (
        <ul className="divide-y divide-ad-border rounded-md border border-ad-border text-[13px]">
          {failures.map((f) => (
            <li key={f.number} className="flex items-center justify-between gap-3 px-3 py-2">
              <Mono>{f.number}</Mono>
              <span className="text-end text-ad-muted">{f.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          {(status === "cancelled" || status === "returned") && (
            <p className="rounded-md bg-ad-amber-soft px-3 py-2 text-[13px] text-ad-amber">Stock is put back for every order. Promo usage is released on cancellation.</p>
          )}
          <Field label="Note" optional hint="Saved on each order's timeline.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Confirmed by phone" />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
