"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Copy, ExternalLink, Package, Pencil, Plus, Star, Tags } from "lucide-react";
import { adminApi, errorMessage, invalidate, useApi, withQuery } from "../lib/client";
import { ago, dzd, num } from "../lib/format";
import { PRODUCT_STATUS } from "../lib/meta";
import type { CategoryRow, Paged, ProductRow } from "../lib/types";
import { useUrlState } from "../data/state";
import { DataTable, Pagination, SelectionBar, nextSort, useColumns, type Column, type Sort } from "../data/table";
import { FilterSelect, ResetFilters, SavedViews, SearchBox, Toolbar } from "../data/toolbar";
import { Badge, Button, Card, EmptyState, LinkButton, PageHeader, Thumb } from "../ui/core";
import { Menu, Tabs, useConfirm, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";

export function StockCell({ stock, low }: { stock: number; low?: boolean }) {
  if (stock === 0) return <Badge tone="red">Épuisé</Badge>;
  return <span className={low ? "font-medium text-ad-amber" : undefined}>{num(stock)}</span>;
}

export function ProductsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useSession();
  const { state, set, reset, activeCount, search } = useUrlState({ status: "", search: "", category: "", stock: "", flag: "", sort: "updated", dir: "desc", page: "1", pageSize: "25" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const q = useApi<Paged<ProductRow>>(withQuery("/admin/products", state));
  const cats = useApi<{ items: CategoryRow[] }>("/admin/categories");
  const catName = (slug: string) => cats.data?.items.find((c) => c.slug === slug)?.translations.fr?.name ?? slug;
  const sort: Sort = { key: state.sort, dir: state.dir as Sort["dir"] };
  const writable = can("catalog:write");

  const columns = useMemo<Column<ProductRow>[]>(
    () => [
      {
        id: "product",
        header: "Produit",
        primary: true,
        hideable: false,
        sortKey: "name",
        cell: (p) => (
          <span className="flex min-w-0 items-center gap-3">
            <Thumb src={p.image} size={36} />
            <span className="min-w-0">
              <span className="block truncate font-medium text-ad-fg">{p.name}</span>
              <span className="block truncate text-xs text-ad-muted">
                {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
                {p.isFeatured ? " · Mis en avant" : ""}
                {p.isBestSeller ? " · Top vente" : ""}
                {p.isNew ? " · Nouveau" : ""}
              </span>
            </span>
          </span>
        ),
      },
      { id: "status", header: "Statut", mobile: true, width: "110px", cell: (p) => <Badge tone={PRODUCT_STATUS[p.status].tone} dot>{PRODUCT_STATUS[p.status].label}</Badge> },
      { id: "category", header: "Catégorie", width: "170px", cell: (p) => <span className="text-ad-muted">{catName(p.categorySlug)}</span> },
      { id: "stock", header: "Stock", sortKey: "stock", align: "end", mobile: true, width: "110px", cell: (p) => <StockCell stock={p.totalStock} low={p.lowVariants > 0} /> },
      {
        id: "price",
        header: "Prix",
        sortKey: "price",
        align: "end",
        mobile: true,
        width: "120px",
        cell: (p) => (
          <span className="whitespace-nowrap">
            {p.variantCount > 1 && <span className="text-ad-faint">dès </span>}
            {dzd(p.minPrice)}
            {p.onSale && <Badge tone="red" className="ms-1.5">Promo</Badge>}
          </span>
        ),
      },
      {
        id: "rating",
        header: "Note",
        sortKey: "rating",
        align: "end",
        width: "100px",
        cell: (p) =>
          p.ratingCount ? (
            <span className="inline-flex items-center gap-1">
              <Star size={12} className="fill-current text-ad-amber" aria-hidden /> {Number(p.ratingAvg).toFixed(1)} <span className="text-ad-faint">({p.ratingCount})</span>
            </span>
          ) : (
            <span className="text-ad-faint">—</span>
          ),
      },
      { id: "updated", header: "Modifié", sortKey: "updated", align: "end", width: "130px", defaultHidden: false, cell: (p) => <span className="whitespace-nowrap text-ad-muted">{ago(p.updatedAt)}</span> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cats.data],
  );
  const cols = useColumns("products", columns);
  const onSort = (key: string) => {
    const n = nextSort(sort, key, key === "name" ? "asc" : "desc");
    set({ sort: n.key, dir: n.dir });
  };
  const setSearch = useCallback((v: string) => set({ search: v }), [set]);

  const bulk = async (patch: Record<string, unknown>, label: string, ids = [...selected]) => {
    try {
      const r = await adminApi<{ updated: number }>("/admin/products/bulk", { method: "POST", body: { ids, patch } });
      invalidate("/admin/products", "/admin/inventory");
      toast.success(`${label} · ${r.updated} produit${r.updated === 1 ? "" : "s"}`);
      setSelected(new Set());
    } catch (err) {
      toast.error("Échec de la modification groupée", errorMessage(err));
    }
  };

  const archiveOne = async (p: ProductRow) => {
    if (!(await confirm({ title: `Archiver ${p.name} ?`, description: "Il disparaît de la boutique. L’historique des commandes est conservé et vous pouvez le réactiver à tout moment.", confirmLabel: "Archiver", variant: "danger" }))) return;
    try {
      await adminApi(`/admin/products/${p.id}`, { method: "DELETE" });
      invalidate("/admin/products");
      toast("Produit archivé", { action: { label: "Annuler", onClick: () => void bulk({ status: p.status }, "Restauré", [p.id]) } });
    } catch (err) {
      toast.error("Archivage impossible", errorMessage(err));
    }
  };

  const filtered = Boolean(activeCount || state.search || state.status);
  return (
    <>
      <PageHeader
        title="Produits"
        description="Tout ce qui est vendu sur la boutique, avec variantes, prix et stock."
        actions={
          writable && (
            <LinkButton href="/admin/products/new" variant="primary">
              <Plus size={15} /> Nouveau produit
            </LinkButton>
          )
        }
      />
      <Card padded={false}>
        <div className="px-4 pt-1">
          <Tabs
            value={state.status}
            onChange={(v) => set({ status: v })}
            tabs={[
              { value: "", label: "Tous" },
              { value: "active", label: "Actifs" },
              { value: "draft", label: "Brouillons" },
              { value: "archived", label: "Archivés" },
            ]}
          />
        </div>
        {selected.size > 0 && writable ? (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} totalOnPage={q.data?.items.length}>
            <Button size="sm" onClick={() => bulk({ status: "active" }, "Publiés")}>
              Publier
            </Button>
            <Button size="sm" onClick={() => bulk({ status: "draft" }, "Passés en brouillon")}>
              Passer en brouillon
            </Button>
            <Menu
              label="Autres actions groupées"
              items={[
                { type: "label", label: "Mise en avant" },
                { label: "Mettre en avant", onSelect: () => void bulk({ isFeatured: true }, "Mis en avant") },
                { label: "Retirer de la mise en avant", onSelect: () => void bulk({ isFeatured: false }, "Mis à jour") },
                { label: "Marquer « Top vente »", onSelect: () => void bulk({ isBestSeller: true }, "Mis à jour") },
                { label: "Marquer « Nouveau »", onSelect: () => void bulk({ isNew: true }, "Mis à jour") },
                { label: "Retirer « Nouveau »", onSelect: () => void bulk({ isNew: false }, "Mis à jour") },
                { type: "separator" },
                { type: "label", label: "Déplacer vers la catégorie" },
                ...(cats.data?.items ?? []).map((c) => ({ label: c.translations.fr?.name ?? c.slug, icon: <Tags size={14} />, onSelect: () => void bulk({ categorySlug: c.slug }, "Déplacés") })),
                { type: "separator" },
                {
                  label: "Archiver",
                  danger: true,
                  icon: <Archive size={14} />,
                  onSelect: async () => {
                    if (await confirm({ title: `Archiver ${selected.size} produits ?`, description: "Ils disparaissent de la boutique. Vous pourrez les réactiver plus tard.", confirmLabel: "Archiver", variant: "danger" }))
                      void bulk({ status: "archived" }, "Archivés");
                  },
                },
              ]}
              trigger={(p) => (
                <Button {...p} size="sm">
                  Plus…
                </Button>
              )}
            />
          </SelectionBar>
        ) : (
          <Toolbar>
            <SearchBox value={state.search} onChange={setSearch} placeholder="Nom, identifiant ou SKU…" label="Rechercher des produits" />
            <FilterSelect label="Catégorie" value={state.category} onChange={(v) => set({ category: v })} width="w-[200px]" options={(cats.data?.items ?? []).map((c) => ({ value: c.slug, label: c.translations.fr?.name ?? c.slug, text: c.translations.fr?.name ?? c.slug }))} />
            <FilterSelect label="Stock" value={state.stock as "" | "low"} onChange={(v) => set({ stock: v })} options={[{ value: "in" as "low", label: "En stock", text: "En stock" }, { value: "low", label: "Stock faible", text: "Stock faible" }, { value: "out" as "low", label: "Épuisé", text: "Épuisé" }]} />
            <FilterSelect
              label="Étiquette"
              value={state.flag as "" | "sale"}
              onChange={(v) => set({ flag: v })}
              options={[
                { value: "featured" as "sale", label: "Mis en avant", text: "Mis en avant" },
                { value: "bestSeller" as "sale", label: "Top vente", text: "Top vente" },
                { value: "new" as "sale", label: "Nouveau", text: "Nouveau" },
                { value: "sale", label: "En promo", text: "En promo" },
              ]}
            />
            <ResetFilters count={activeCount + (state.search ? 1 : 0)} onReset={reset} />
            <div className="ms-auto flex items-center gap-2">
              <SavedViews tableId="products" current={search} onApply={(qs) => window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)} />
              {cols.menu}
            </div>
          </Toolbar>
        )}
        <DataTable
          label="Produits"
          rows={q.data?.items}
          rowId={(p) => p.id}
          columns={cols.visible}
          loading={q.loading}
          stale={q.stale}
          error={q.error}
          onRetry={q.reload}
          sort={sort}
          onSort={onSort}
          selected={writable ? selected : undefined}
          onSelectedChange={writable ? setSelected : undefined}
          rowHref={(p) => `/admin/products/${p.id}`}
          rowActions={(p) => [
            { label: writable ? "Edit" : "View", icon: <Pencil size={14} />, onSelect: () => router.push(`/admin/products/${p.id}`) },
            { label: "Voir sur la boutique", icon: <ExternalLink size={14} />, disabled: p.status !== "active", onSelect: () => window.open(`/products/${p.slug}`, "_blank", "noopener") },
            ...(writable ? [{ label: "Duplicate", icon: <Copy size={14} />, onSelect: () => router.push(`/admin/products/new?from=${p.id}`) }] : []),
            ...(writable && p.status !== "archived" ? [{ type: "separator" as const }, { label: "Archiver", danger: true, icon: <Archive size={14} />, onSelect: () => void archiveOne(p) }] : []),
          ]}
          empty={
            <EmptyState
              icon={<Package size={18} />}
              title={filtered ? "Aucun produit ne correspond à ces filtres" : "Aucun produit pour le moment"}
              description={filtered ? "Essayez une autre recherche ou effacez les filtres." : "Créez votre premier produit pour commencer à vendre."}
              action={filtered ? <Button size="sm" onClick={reset}>Effacer les filtres</Button> : writable ? <LinkButton size="sm" variant="primary" href="/admin/products/new">Nouveau produit</LinkButton> : undefined}
            />
          }
        />
        <Pagination page={Number(state.page)} pageSize={Number(state.pageSize)} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} onPageSize={(s) => set({ pageSize: String(s) })} />
      </Card>
    </>
  );
}
