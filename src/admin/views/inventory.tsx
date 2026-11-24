"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, History, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminApi, errorMessage, invalidate, useApi, withQuery } from "../lib/client";
import { ago, dzd, dzdCompact, fmtDateTime, num } from "../lib/format";
import { MOVEMENT_REASON, PRODUCT_STATUS } from "../lib/meta";
import type { CategoryRow, InventoryResponse, InventoryRow, Movement, Paged } from "../lib/types";
import { useUrlState } from "../data/state";
import { DataTable, Pagination, nextSort, useColumns, type Column, type Sort } from "../data/table";
import { FilterSelect, ResetFilters, SavedViews, SearchBox, Toolbar } from "../data/toolbar";
import { Badge, Button, Card, EmptyState, Field, Input, Mono, PageHeader, Skeleton, Textarea, Thumb } from "../ui/core";
import { Dialog, Select, Tabs, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";
import { StockDialog, type StockTarget } from "./stock-dialog";

export function InventoryPage() {
  const { state } = useUrlState({ tab: "stock" });
  return (
    <>
      <PageHeader title="Inventory" description="Stock on hand per variant. Every change is recorded in the stock ledger." />
      <div className="mb-4">
        <Tabs
          value={state.tab}
          onChange={(v) => window.history.replaceState(null, "", v === "stock" ? window.location.pathname : `?tab=${v}`)}
          tabs={[
            { value: "stock", label: "Stock levels" },
            { value: "ledger", label: "Movements" },
          ]}
        />
      </div>
      {state.tab === "ledger" ? <Ledger /> : <StockLevels />}
    </>
  );
}

function StockLevels() {
  const toast = useToast();
  const { can } = useSession();
  const writable = can("inventory:write");
  const { state, set, reset, activeCount, search } = useUrlState({ tab: "", search: "", stock: "", category: "", sort: "stock", dir: "asc", page: "1", pageSize: "50" });
  const q = useApi<InventoryResponse>(withQuery("/admin/inventory", { search: state.search, stock: state.stock, category: state.category, sort: state.sort, dir: state.dir, page: state.page, pageSize: state.pageSize }));
  const cats = useApi<{ items: CategoryRow[] }>("/admin/categories");
  const [target, setTarget] = useState<StockTarget | null>(null);
  // inline edits: variantId → new on-hand value (saved together, all-or-nothing)
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const sort: Sort = { key: state.sort, dir: state.dir as Sort["dir"] };
  const s = q.data?.summary;
  const changed = Object.entries(edits).filter(([id, v]) => v !== "" && q.data?.items.find((r) => r.variantId === id)?.stock !== Number(v));

  const columns = useMemo<Column<InventoryRow>[]>(
    () => [
      {
        id: "variant",
        header: "Product",
        primary: true,
        hideable: false,
        sortKey: "name",
        cell: (r) => (
          <span className="flex min-w-0 items-center gap-3">
            <Thumb src={r.image} size={32} />
            <span className="min-w-0">
              <Link href={`/admin/products/${r.productId}`} className="block truncate font-medium text-ad-fg hover:underline">
                {r.productName}
              </Link>
              <span className="block truncate text-xs text-ad-muted">
                {r.label ?? r.code}
                {!r.isActive && " · inactive"}
                {r.productStatus !== "active" && ` · ${PRODUCT_STATUS[r.productStatus]?.label.toLowerCase()}`}
              </span>
            </span>
          </span>
        ),
      },
      { id: "sku", header: "SKU", sortKey: "sku", mobile: true, width: "190px", cell: (r) => <Mono className="text-ad-muted">{r.sku}</Mono> },
      { id: "price", header: "Price", sortKey: "price", align: "end", width: "110px", cell: (r) => dzd(r.price) },
      { id: "sold", header: "Sold (30d)", align: "end", width: "100px", cell: (r) => <span className="text-ad-muted">{num(r.sold30)}</span> },
      {
        id: "cover",
        header: "Cover",
        align: "end",
        width: "100px",
        defaultHidden: true,
        cell: (r) => {
          const perDay = r.sold30 / 30;
          if (!perDay) return <span className="text-ad-faint">—</span>;
          const days = Math.floor(r.stock / perDay);
          return <span className={days < 7 ? "text-ad-amber" : "text-ad-muted"}>{days}d</span>;
        },
      },
      { id: "moved", header: "Last movement", width: "140px", cell: (r) => <span className="whitespace-nowrap text-ad-muted">{ago(r.lastMovementAt)}</span> },
      {
        id: "stock",
        header: "On hand",
        sortKey: "stock",
        align: "end",
        mobile: true,
        width: "150px",
        cell: (r) =>
          writable ? (
            <span className="inline-flex items-center justify-end gap-2" data-no-row-click>
              {r.stock === 0 && edits[r.variantId] === undefined && <Badge tone="red">Out</Badge>}
              {r.stock > 0 && r.stock <= (s?.lowThreshold ?? 5) && edits[r.variantId] === undefined && <Badge tone="amber">Low</Badge>}
              <Input
                aria-label={`On hand for ${r.sku}`}
                inputSize="sm"
                inputMode="numeric"
                className={cn("w-20 text-end tnum", edits[r.variantId] !== undefined && Number(edits[r.variantId]) !== r.stock && "border-ad-fg/50")}
                value={edits[r.variantId] ?? String(r.stock)}
                onChange={(e) => setEdits((x) => ({ ...x, [r.variantId]: e.target.value.replace(/\D/g, "").slice(0, 7) }))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEdits((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== r.variantId)));
                  if (e.key === "Enter") setReviewing(true);
                }}
                onFocus={(e) => e.target.select()}
              />
            </span>
          ) : (
            <span className={cn("font-medium", r.stock === 0 && "text-ad-red")}>{num(r.stock)}</span>
          ),
      },
    ],
    [writable, edits, s?.lowThreshold],
  );
  const cols = useColumns("inventory", columns);
  const setSearch = useCallback((v: string) => set({ search: v }), [set]);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ad-border bg-ad-border shadow-ad lg:grid-cols-4">
        {[
          { label: "Units on hand", value: s ? num(s.units) : null },
          { label: "Stock value (retail)", value: s ? dzdCompact(s.value) : null },
          { label: `Low stock (≤ ${s?.lowThreshold ?? 5})`, value: s ? num(s.low) : null, href: "?stock=low", tone: s && s.low > 0 ? "text-ad-amber" : "" },
          { label: "Out of stock", value: s ? num(s.out) : null, href: "?stock=out", tone: s && s.out > 0 ? "text-ad-red" : "" },
        ].map((k) => (
          <div key={k.label} className="bg-ad-panel p-4">
            <p className="text-[13px] text-ad-muted">{k.label}</p>
            {k.value === null ? (
              <Skeleton className="mt-2 h-6 w-20" />
            ) : k.href ? (
              <button type="button" onClick={() => set({ stock: k.href!.split("=")[1] })} className={cn("tnum mt-1 cursor-pointer text-xl font-semibold hover:underline", k.tone)}>
                {k.value}
              </button>
            ) : (
              <p className="tnum mt-1 text-xl font-semibold">{k.value}</p>
            )}
          </div>
        ))}
      </div>
      <Card padded={false}>
        {changed.length > 0 ? (
          <div role="region" aria-label="Unsaved stock changes" className="ad-anim-fade flex flex-wrap items-center gap-2 border-b border-ad-border bg-ad-subtle px-4 py-2.5">
            <span className="text-[13px] font-medium">
              {changed.length} unsaved change{changed.length === 1 ? "" : "s"}
            </span>
            <div className="ms-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEdits({})}>
                Discard
              </Button>
              <Button size="sm" variant="primary" onClick={() => setReviewing(true)}>
                Review & save
              </Button>
            </div>
          </div>
        ) : (
          <Toolbar>
            <SearchBox value={state.search} onChange={setSearch} placeholder="Product, SKU or code…" label="Search inventory" />
            <FilterSelect
              label="Stock"
              value={state.stock as "" | "low"}
              onChange={(v) => set({ stock: v })}
              options={[
                { value: "low", label: "Low", text: "Low" },
                { value: "out" as "low", label: "Out of stock", text: "Out of stock" },
                { value: "in" as "low", label: "Healthy", text: "Healthy" },
              ]}
            />
            <FilterSelect label="Category" width="w-[200px]" value={state.category} onChange={(v) => set({ category: v })} options={(cats.data?.items ?? []).map((c) => ({ value: c.slug, label: c.translations.fr?.name ?? c.slug, text: c.translations.fr?.name ?? c.slug }))} />
            <ResetFilters count={activeCount - (state.tab ? 1 : 0) + (state.search ? 1 : 0)} onReset={reset} />
            <div className="ms-auto flex items-center gap-2">
              <SavedViews tableId="inventory" current={search} onApply={(qs) => window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)} />
              {cols.menu}
            </div>
          </Toolbar>
        )}
        <DataTable
          label="Inventory"
          rows={q.data?.items}
          rowId={(r) => r.variantId}
          columns={cols.visible}
          loading={q.loading}
          stale={q.stale}
          error={q.error}
          onRetry={q.reload}
          sort={sort}
          onSort={(key) => {
            const n = nextSort(sort, key, key === "stock" || key === "name" || key === "sku" ? "asc" : "desc");
            set({ sort: n.key, dir: n.dir });
          }}
          rowActions={
            writable
              ? (r) => [
                  { label: "Adjust stock…", icon: <SlidersHorizontal size={14} />, onSelect: () => setTarget({ variantId: r.variantId, sku: r.sku, label: `${r.productName} · ${r.label ?? r.code}`, stock: r.stock }) },
                  { label: "View movements", icon: <History size={14} />, onSelect: () => window.history.pushState(null, "", `?tab=ledger&variant=${r.variantId}`) },
                ]
              : undefined
          }
          empty={<EmptyState icon={<Boxes size={18} />} title="No variants match" description="Try another search or filter." />}
        />
        <Pagination page={Number(state.page)} pageSize={Number(state.pageSize)} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} onPageSize={(n) => set({ pageSize: String(n) })} />
      </Card>
      <StockDialog target={target} onClose={() => setTarget(null)} />
      <BulkReview
        open={reviewing}
        onClose={() => setReviewing(false)}
        items={changed.map(([id, v]) => {
          const r = q.data!.items.find((x) => x.variantId === id)!;
          return { row: r, next: Number(v) };
        })}
        onSaved={() => {
          setEdits({});
          setReviewing(false);
          toast.success("Stock updated");
        }}
      />
    </>
  );
}

function BulkReview({ open, onClose, items, onSaved }: { open: boolean; onClose: () => void; items: { row: InventoryRow; next: number }[]; onSaved: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<"adjustment" | "restock" | "return">("adjustment");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  if (!open || !items.length) return null;
  const save = async () => {
    setPending(true);
    try {
      await adminApi("/admin/inventory/bulk", { method: "POST", body: { reason, note: note.trim() || null, items: items.map((i) => ({ variantId: i.row.variantId, set: i.next })) } });
      invalidate("/admin/inventory", "/admin/products", "/admin/analytics");
      setNote("");
      onSaved();
    } catch (err) {
      toast.error("Nothing was saved", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Update ${items.length} variant${items.length === 1 ? "" : "s"}`}
      description="All changes are applied together, or none are."
      footer={
        <>
          <Button onClick={onClose}>Keep editing</Button>
          <Button variant="primary" loading={pending} onClick={save}>
            Save {items.length} change{items.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <ul className="mb-4 divide-y divide-ad-border rounded-md border border-ad-border text-[13px]">
        {items.map(({ row, next }) => {
          const d = next - row.stock;
          return (
            <li key={row.variantId} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate">
                {row.productName} <Mono className="text-ad-muted">{row.sku}</Mono>
              </span>
              <span className="tnum shrink-0 text-ad-muted">
                {row.stock} → <span className="font-medium text-ad-fg">{next}</span>
              </span>
              <span className={cn("tnum w-12 shrink-0 text-end font-medium", d > 0 ? "text-ad-green" : "text-ad-red")}>{d > 0 ? `+${d}` : d}</span>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Reason" htmlFor="bulk-reason">
          <Select
            id="bulk-reason"
            value={reason}
            onChange={setReason}
            options={[
              { value: "adjustment", label: "Adjustment / stock count" },
              { value: "restock", label: "Restock" },
              { value: "return", label: "Customer return" },
            ]}
          />
        </Field>
        <Field label="Note" optional className="sm:col-span-2">
          <Textarea rows={2} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly stock count" />
        </Field>
      </div>
    </Dialog>
  );
}

function Ledger() {
  const { state, set } = useUrlState({ tab: "", variant: "", reason: "", page: "1" });
  const q = useApi<Paged<Movement>>(withQuery("/admin/inventory/movements", { variantId: state.variant, reason: state.reason, page: state.page, pageSize: 50 }));
  const columns: Column<Movement>[] = [
    { id: "date", header: "Date", primary: true, width: "160px", cell: (m) => <span className="whitespace-nowrap">{fmtDateTime(m.createdAt)}</span> },
    {
      id: "item",
      header: "Item",
      mobile: true,
      cell: (m) => (
        <span className="min-w-0">
          <Link href={`/admin/products/${m.productId}`} className="block truncate hover:underline">
            {m.productName}
          </Link>
          <Mono className="text-xs text-ad-muted">{m.sku}</Mono>
        </span>
      ),
    },
    { id: "reason", header: "Reason", mobile: true, width: "130px", cell: (m) => <Badge tone={MOVEMENT_REASON[m.reason].tone}>{MOVEMENT_REASON[m.reason].label}</Badge> },
    {
      id: "ref",
      header: "Reference",
      cell: (m) =>
        m.orderNumber ? (
          <Link href={`/admin/orders/${m.orderNumber}`} className="hover:underline">
            <Mono>{m.orderNumber}</Mono>
          </Link>
        ) : (
          <span className="text-ad-muted">{m.note ?? "—"}</span>
        ),
    },
    { id: "by", header: "By", cell: (m) => <span className="text-ad-muted">{m.actorName ?? (m.orderNumber ? "Customer" : "System")}</span> },
    { id: "delta", header: "Change", align: "end", mobile: true, width: "90px", cell: (m) => <span className={cn("font-medium", m.delta > 0 ? "text-ad-green" : "text-ad-red")}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span> },
    { id: "after", header: "Balance", align: "end", width: "90px", cell: (m) => m.stockAfter },
  ];
  return (
    <Card padded={false}>
      <Toolbar>
        <FilterSelect label="Reason" value={state.reason as "" | "order"} onChange={(v) => set({ reason: v })} options={Object.entries(MOVEMENT_REASON).map(([value, m]) => ({ value: value as "order", label: m.label, text: m.label }))} />
        {state.variant && (
          <Button size="sm" variant="ghost" onClick={() => set({ variant: "" })}>
            Showing one variant · show all
          </Button>
        )}
      </Toolbar>
      <DataTable label="Stock movements" rows={q.data?.items} rowId={(m) => m.id} columns={columns} loading={q.loading} stale={q.stale} error={q.error} onRetry={q.reload} empty={<EmptyState icon={<History size={18} />} title="No movements" />} />
      <Pagination page={Number(state.page)} pageSize={50} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} />
    </Card>
  );
}
