"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Eye, EyeOff, MessageSquareText, Star } from "lucide-react";
import { adminApi, errorMessage, invalidate, useApi, withQuery } from "../lib/client";
import { ago, fmtFull } from "../lib/format";
import type { ReviewRow, ReviewsResponse } from "../lib/types";
import { useUrlState } from "../data/state";
import { DataTable, Pagination, SelectionBar, nextSort, type Column, type Sort } from "../data/table";
import { FilterSelect, ResetFilters, SearchBox, Toolbar } from "../data/toolbar";
import { Badge, Button, Card, EmptyState, PageHeader } from "../ui/core";
import { Drawer, Tabs, useToast } from "../ui/overlay";

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-px text-ad-amber" role="img" aria-label={`${rating} étoile${rating > 1 ? "s" : ""} sur 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={12} className={i < rating ? "fill-current" : "opacity-25"} aria-hidden />
      ))}
    </span>
  );
}

export function ReviewsPage() {
  const toast = useToast();
  const { state, set, reset, activeCount } = useUrlState({ status: "", rating: "", q: "", product: "", sort: "created", dir: "desc", page: "1" });
  const q = useApi<ReviewsResponse>(withQuery("/admin/reviews", { status: state.status, rating: state.rating, q: state.q, productId: state.product, sort: state.sort, dir: state.dir, page: state.page, pageSize: 25 }));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<ReviewRow | null>(null);
  const sort: Sort = { key: state.sort, dir: state.dir as Sort["dir"] };
  const counts = q.data?.counts;

  const moderate = async (ids: string[], status: "published" | "hidden") => {
    try {
      const r = await adminApi<{ updated: number }>("/admin/reviews/bulk", { method: "POST", body: { ids, status } });
      invalidate("/admin/reviews", "/admin/products");
      toast.success(`${r.updated} avis ${status === "hidden" ? (r.updated === 1 ? "masqué" : "masqués") : r.updated === 1 ? "publié" : "publiés"}`, status === "hidden" ? "Les notes des produits ont été recalculées." : undefined);
      setSelected(new Set());
      setOpen(null);
    } catch (err) {
      toast.error("Impossible de mettre à jour les avis", errorMessage(err));
    }
  };

  const columns: Column<ReviewRow>[] = [
    {
      id: "review",
      header: "Avis",
      primary: true,
      cell: (r) => (
        <span className="block min-w-0 max-w-[520px]">
          <span className="flex items-center gap-2">
            <Stars rating={r.rating} />
            {r.title && <span className="truncate font-medium">{r.title}</span>}
          </span>
          <span className="mt-0.5 line-clamp-1 text-xs text-ad-muted">{r.body}</span>
        </span>
      ),
    },
    {
      id: "product",
      header: "Produit",
      mobile: true,
      cell: (r) => (
        <Link href={`/admin/products/${r.productId}`} className="block max-w-[200px] truncate text-ad-fg hover:underline">
          {r.productName}
        </Link>
      ),
    },
    {
      id: "author",
      header: "Auteur",
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <Link href={`/admin/customers/${r.userId}`} className="truncate hover:underline">
            {r.authorName}
          </Link>
          {r.verified && <BadgeCheck size={14} className="shrink-0 text-ad-green" aria-label="Achat vérifié" />}
        </span>
      ),
    },
    { id: "status", header: "Statut", mobile: true, width: "110px", cell: (r) => (r.status === "published" ? <Badge tone="green" dot>Publié</Badge> : <Badge dot>Masqué</Badge>) },
    { id: "date", header: "Date", sortKey: "created", align: "end", width: "120px", cell: (r) => <span className="whitespace-nowrap text-ad-muted">{ago(r.createdAt)}</span> },
  ];
  const setQ = useCallback((v: string) => set({ q: v }), [set]);

  return (
    <>
      <PageHeader title="Avis" description={counts ? `${counts.all} avis d’acheteurs vérifiés · moyenne de ${counts.avg.toFixed(2).replace(".", ",")} / 5 sur les avis publiés` : "Avis d’acheteurs vérifiés."} />
      <Card padded={false}>
        <div className="px-4 pt-1">
          <Tabs
            value={state.status}
            onChange={(v) => set({ status: v })}
            tabs={[
              { value: "", label: "Tous", count: counts?.all },
              { value: "published", label: "Publiés", count: counts?.published },
              { value: "hidden", label: "Masqués", count: counts?.hidden },
            ]}
          />
        </div>
        {selected.size > 0 ? (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button size="sm" onClick={() => moderate([...selected], "published")}>
              <Eye size={14} /> Publier
            </Button>
            <Button size="sm" onClick={() => moderate([...selected], "hidden")}>
              <EyeOff size={14} /> Masquer
            </Button>
          </SelectionBar>
        ) : (
          <Toolbar>
            <SearchBox value={state.q} onChange={setQ} placeholder="Texte, produit ou auteur…" label="Rechercher des avis" />
            <FilterSelect label="Note" value={state.rating as "" | "5"} onChange={(v) => set({ rating: v })} options={["5", "4", "3", "2", "1"].map((n) => ({ value: n as "5", label: `${n} étoile${n === "1" ? "" : "s"}`, text: `${n} étoiles` }))} />
            {state.product && (
              <Button size="sm" variant="ghost" onClick={() => set({ product: "" })}>
                Un seul produit · tout afficher
              </Button>
            )}
            <ResetFilters count={activeCount + (state.q ? 1 : 0)} onReset={reset} />
          </Toolbar>
        )}
        <DataTable
          label="Avis"
          rows={q.data?.items}
          rowId={(r) => r.id}
          columns={columns}
          loading={q.loading}
          stale={q.stale}
          error={q.error}
          onRetry={q.reload}
          sort={sort}
          onSort={(k) => {
            const n = nextSort(sort, k);
            set({ sort: n.key, dir: n.dir });
          }}
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={setOpen}
          rowClassName={(r) => (r.status === "hidden" ? "text-ad-muted" : undefined)}
          rowActions={(r) => [r.status === "published" ? { label: "Masquer", icon: <EyeOff size={14} />, onSelect: () => void moderate([r.id], "hidden") } : { label: "Publier", icon: <Eye size={14} />, onSelect: () => void moderate([r.id], "published") }]}
          empty={<EmptyState icon={<MessageSquareText size={18} />} title="Aucun avis ne correspond" />}
        />
        <Pagination page={Number(state.page)} pageSize={25} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} />
      </Card>
      {open && (
        <Drawer
          open
          onClose={() => setOpen(null)}
          title={open.title || "Avis"}
          description={`${open.productName} · ${fmtFull(open.createdAt)}`}
          footer={
            <>
              <Button onClick={() => setOpen(null)}>Fermer</Button>
              {open.status === "published" ? (
                <Button variant="primary" onClick={() => moderate([open.id], "hidden")}>
                  <EyeOff size={14} /> Masquer l’avis
                </Button>
              ) : (
                <Button variant="primary" onClick={() => moderate([open.id], "published")}>
                  <Eye size={14} /> Publier l’avis
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Stars rating={open.rating} />
              {open.status === "hidden" ? <Badge>Masqué</Badge> : <Badge tone="green">Publié</Badge>}
              {open.verified && <Badge tone="green">Achat vérifié</Badge>}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed" dir="auto">
              {open.body}
            </p>
            <div className="border-t border-ad-border pt-4 text-ad-muted">
              By{" "}
              <Link href={`/admin/customers/${open.userId}`} className="text-ad-fg hover:underline">
                {open.authorName}
              </Link>{" "}
              · {open.authorEmail}
            </div>
            <p className="text-xs text-ad-faint">Un avis masqué disparaît de la page produit et de sa note moyenne.</p>
          </div>
        </Drawer>
      )}
    </>
  );
}
