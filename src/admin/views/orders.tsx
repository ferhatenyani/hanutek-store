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
  { value: "", label: "Toutes" },
  { value: "pending,confirmed", label: "À confirmer" },
  { value: "packed", label: "À expédier" },
  { value: "shipped,out_for_delivery", label: "En transit" },
  { value: "delivered", label: "Livrées" },
  { value: "cancelled,returned", label: "Annulées et retournées" },
] as const;

const RANGES = [
  { value: "1", label: "Aujourd’hui" },
  { value: "7", label: "7 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
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
  const head = ["numero", "date", "statut", "paiement", "client", "telephone", "wilaya", "articles", "total", "transporteur", "suivi"];
  const body = rows.map((o) => [o.number, o.placedAt, ORDER_STATUS[o.status].label, PAYMENT_STATUS[o.paymentStatus].label, o.customer.name, o.customer.phone, o.wilaya, o.itemCount, o.total, o.carrier, o.trackingNumber].map(esc).join(","));
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
        header: "Commande",
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
        header: "Client",
        mobile: true,
        cell: (o) => (
          <span className="block min-w-0 max-w-[220px]">
            <span className="block truncate text-ad-fg">{o.customer.name}</span>
            <span className="block truncate text-xs text-ad-muted max-md:hidden">{o.customer.phone}</span>
          </span>
        ),
      },
      { id: "status", header: "Statut", width: "140px", cell: (o) => <Badge tone={ORDER_STATUS[o.status].tone} dot>{ORDER_STATUS[o.status].label}</Badge> },
      { id: "payment", header: "Paiement", width: "110px", cell: (o) => <Badge tone={PAYMENT_STATUS[o.paymentStatus].tone}>{PAYMENT_STATUS[o.paymentStatus].label}</Badge> },
      { id: "items", header: "Articles", align: "end", width: "70px", cell: (o) => o.itemCount },
      { id: "region", header: "Wilaya", cell: (o) => <span className="whitespace-nowrap text-ad-muted">{wilayaName(o.wilaya)}</span> },
      { id: "carrier", header: "Transporteur", defaultHidden: true, cell: (o) => (o.carrier ? <span className="text-ad-muted">{o.carrier}</span> : <span className="text-ad-faint">—</span>) },
      { id: "promo", header: "Code promo", defaultHidden: true, cell: (o) => (o.promoCode ? <Mono className="text-ad-muted">{o.promoCode}</Mono> : <span className="text-ad-faint">—</span>) },
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
        title="Commandes"
        description="Commandes payées à la livraison, de la confirmation à l’encaissement."
        actions={
          <Button onClick={() => downloadUrl(withQuery("/api/v1/admin/orders/export", { status: state.status, q: state.q, paymentStatus: state.payment, wilaya: state.wilaya, from: state.range ? startOfDaysAgo(Number(state.range)) : "" }))}>
            <Download size={14} /> Exporter en CSV
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
                label="Changer le statut"
                items={ORDER_STATUSES.filter((s) => s !== "pending").map((s) => ({ label: TRANSITION_VERB[s], onSelect: () => setBulk(s), danger: s === "cancelled" || s === "returned" }))}
                trigger={(p) => (
                  <Button {...p} size="sm" variant="primary">
                    <ListChecks size={14} /> Changer le statut
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
              <Download size={14} /> Exporter la sélection
            </Button>
          </SelectionBar>
        ) : (
          <Toolbar>
            <SearchBox value={state.q} onChange={setQ} placeholder="Numéro, nom, téléphone, suivi…" label="Rechercher des commandes" />
            <FilterSelect label="Paiement" value={state.payment as "" | "unpaid"} onChange={(v) => set({ payment: v })} options={Object.entries(PAYMENT_STATUS).map(([value, m]) => ({ value: value as "unpaid", label: m.label, text: m.label }))} />
            <FilterSelect
              label="Date"
              allLabel="Toutes dates"
              width="w-[170px]"
              value={state.range as "" | "7"}
              onChange={(v) => set({ range: v })}
              options={RANGES.map((r) => ({ value: r.value as "7", label: r.label, text: r.label }))}
            />
            <div className="w-[190px]">
              <Select
                size="sm"
                ariaLabel="Wilaya"
                prefix="Wilaya"
                value={state.wilaya}
                onChange={(v) => set({ wilaya: v })}
                options={[{ value: "", label: "Toutes", text: "Toutes" }, ...WILAYAS.map((w) => ({ value: w.code, label: `${w.code} · ${w.fr}`, text: `${w.code} ${w.fr}` }))]}
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
          label="Commandes"
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
            { label: "Ouvrir la commande", icon: <ReceiptText size={14} />, onSelect: () => router.push(`/admin/orders/${o.number}`) },
            { label: "Copier le numéro", icon: <Copy size={14} />, onSelect: () => void navigator.clipboard?.writeText(o.number).then(() => toast("Numéro de commande copié")) },
            ...(o.customer.userId && can("customers:read") ? [{ label: "Voir le client", icon: <ExternalLink size={14} />, onSelect: () => router.push(`/admin/customers/${o.customer.userId}`) }] : []),
          ]}
          empty={
            <EmptyState
              icon={<ReceiptText size={18} />}
              title={activeCount || state.q || state.status ? "Aucune commande ne correspond à ces filtres" : "Aucune commande pour le moment"}
              description={activeCount || state.q || state.status ? "Essayez un autre onglet de statut ou effacez les filtres." : "Les commandes passées sur la boutique apparaîtront ici."}
              action={activeCount || state.q || state.status ? <Button size="sm" onClick={reset}>Effacer les filtres</Button> : undefined}
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

/** "Cannot move an order from pending to packed" → French, with the status labels. */
function transitionError(message?: string) {
  const m = message?.match(/from (\w+) to (\w+)/);
  const from = m && ORDER_STATUS[m[1] as OrderStatus];
  const to = m && ORDER_STATUS[m[2] as OrderStatus];
  return from && to ? `Impossible de passer de « ${from.label} » à « ${to.label} »` : "Changement de statut impossible depuis le statut actuel";
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
        toast.success(`${r.updated} commande${r.updated === 1 ? "" : "s"} mise${r.updated === 1 ? "" : "s"} à jour`, `Nouveau statut : ${ORDER_STATUS[status].label.toLowerCase()}.`);
        setNote("");
        onDone([]);
      } else {
        toast(`${r.updated} mise${r.updated === 1 ? "" : "s"} à jour, ${r.failed} ignorée${r.failed === 1 ? "" : "s"}`, { tone: r.updated ? "info" : "error", description: "Certaines commandes ne peuvent pas passer à ce statut depuis leur statut actuel." });
        setFailures(r.results.filter((x) => !x.ok).map((x) => ({ ...x, message: transitionError(x.message) })));
      }
    } catch (err) {
      toast.error("Impossible de mettre à jour les commandes", errorMessage(err));
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
      title={failures ? "Certaines commandes ont été ignorées" : `${TRANSITION_VERB[status]} · ${numbers.length} commande${numbers.length === 1 ? "" : "s"}`}
      description={failures ? "Ces commandes ont gardé leur statut. Elles restent sélectionnées pour que vous puissiez les vérifier." : ORDER_STATUS[status].hint}
      footer={
        failures ? (
          <Button variant="primary" onClick={close}>
            Terminé
          </Button>
        ) : (
          <>
            <Button onClick={close}>Annuler</Button>
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
            <p className="rounded-md bg-ad-amber-soft px-3 py-2 text-[13px] text-ad-amber">Le stock est réintégré pour chaque commande. L’utilisation du code promo est libérée en cas d’annulation.</p>
          )}
          <Field label="Note" optional hint="Enregistrée dans l’historique de chaque commande.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="ex. Confirmée par téléphone" />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
