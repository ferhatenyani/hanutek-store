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
  if (stock === 0) return <Badge tone="red">Out of stock</Badge>;
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
        header: "Product",
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
                {p.isFeatured ? " · Featured" : ""}
                {p.isBestSeller ? " · Best seller" : ""}
                {p.isNew ? " · New" : ""}
              </span>
            </span>
          </span>
        ),
      },
      { id: "status", header: "Status", mobile: true, width: "110px", cell: (p) => <Badge tone={PRODUCT_STATUS[p.status].tone} dot>{PRODUCT_STATUS[p.status].label}</Badge> },
      { id: "category", header: "Category", width: "170px", cell: (p) => <span className="text-ad-muted">{catName(p.categorySlug)}</span> },
      { id: "stock", header: "Stock", sortKey: "stock", align: "end", mobile: true, width: "110px", cell: (p) => <StockCell stock={p.totalStock} low={p.lowVariants > 0} /> },
      {
        id: "price",
        header: "Price",
        sortKey: "price",
        align: "end",
        mobile: true,
        width: "120px",
        cell: (p) => (
          <span className="whitespace-nowrap">
            {p.variantCount > 1 && <span className="text-ad-faint">from </span>}
            {dzd(p.minPrice)}
            {p.onSale && <Badge tone="red" className="ms-1.5">Sale</Badge>}
          </span>
        ),
      },
      {
        id: "rating",
        header: "Rating",
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
      { id: "updated", header: "Updated", sortKey: "updated", align: "end", width: "130px", defaultHidden: false, cell: (p) => <span className="whitespace-nowrap text-ad-muted">{ago(p.updatedAt)}</span> },
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
      toast.success(`${r.updated} product${r.updated === 1 ? "" : "s"} ${label}`);
      setSelected(new Set());
    } catch (err) {
      toast.error("Bulk update failed", errorMessage(err));
    }
  };

  const archiveOne = async (p: ProductRow) => {
    if (!(await confirm({ title: `Archive ${p.name}?`, description: "It disappears from the store. Order history is kept and you can reactivate it at any time.", confirmLabel: "Archive", variant: "danger" }))) return;
    try {
      await adminApi(`/admin/products/${p.id}`, { method: "DELETE" });
      invalidate("/admin/products");
      toast("Product archived", { action: { label: "Undo", onClick: () => void bulk({ status: p.status }, "restored", [p.id]) } });
    } catch (err) {
      toast.error("Couldn't archive", errorMessage(err));
    }
  };

  const filtered = Boolean(activeCount || state.search || state.status);
  return (
    <>
      <PageHeader
        title="Products"
        description="Everything sold on the store, with variants, prices and stock."
        actions={
          writable && (
            <LinkButton href="/admin/products/new" variant="primary">
              <Plus size={15} /> New product
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
              { value: "", label: "All" },
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "archived", label: "Archived" },
            ]}
          />
        </div>
        {selected.size > 0 && writable ? (
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} totalOnPage={q.data?.items.length}>
            <Button size="sm" onClick={() => bulk({ status: "active" }, "published")}>
              Publish
            </Button>
            <Button size="sm" onClick={() => bulk({ status: "draft" }, "moved to draft")}>
              Move to draft
            </Button>
            <Menu
              label="More bulk actions"
              items={[
                { type: "label", label: "Merchandising" },
                { label: "Mark as featured", onSelect: () => void bulk({ isFeatured: true }, "featured") },
                { label: "Remove featured", onSelect: () => void bulk({ isFeatured: false }, "updated") },
                { label: "Mark as best seller", onSelect: () => void bulk({ isBestSeller: true }, "updated") },
                { label: "Mark as new", onSelect: () => void bulk({ isNew: true }, "updated") },
                { label: "Remove “new”", onSelect: () => void bulk({ isNew: false }, "updated") },
                { type: "separator" },
                { type: "label", label: "Move to category" },
                ...(cats.data?.items ?? []).map((c) => ({ label: c.translations.fr?.name ?? c.slug, icon: <Tags size={14} />, onSelect: () => void bulk({ categorySlug: c.slug }, "moved") })),
                { type: "separator" },
                {
                  label: "Archive",
                  danger: true,
                  icon: <Archive size={14} />,
                  onSelect: async () => {
                    if (await confirm({ title: `Archive ${selected.size} products?`, description: "They disappear from the store. You can reactivate them later.", confirmLabel: "Archive", variant: "danger" }))
                      void bulk({ status: "archived" }, "archived");
                  },
                },
              ]}
              trigger={(p) => (
                <Button {...p} size="sm">
                  More…
                </Button>
              )}
            />
          </SelectionBar>
        ) : (
          <Toolbar>
            <SearchBox value={state.search} onChange={setSearch} placeholder="Name, slug or SKU…" label="Search products" />
            <FilterSelect label="Category" value={state.category} onChange={(v) => set({ category: v })} width="w-[200px]" options={(cats.data?.items ?? []).map((c) => ({ value: c.slug, label: c.translations.fr?.name ?? c.slug, text: c.translations.fr?.name ?? c.slug }))} />
            <FilterSelect label="Stock" value={state.stock as "" | "low"} onChange={(v) => set({ stock: v })} options={[{ value: "in" as "low", label: "In stock", text: "In stock" }, { value: "low", label: "Low stock", text: "Low stock" }, { value: "out" as "low", label: "Out of stock", text: "Out of stock" }]} />
            <FilterSelect
              label="Tag"
              value={state.flag as "" | "sale"}
              onChange={(v) => set({ flag: v })}
              options={[
                { value: "featured" as "sale", label: "Featured", text: "Featured" },
                { value: "bestSeller" as "sale", label: "Best seller", text: "Best seller" },
                { value: "new" as "sale", label: "New", text: "New" },
                { value: "sale", label: "On sale", text: "On sale" },
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
          label="Products"
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
            { label: "View on store", icon: <ExternalLink size={14} />, disabled: p.status !== "active", onSelect: () => window.open(`/products/${p.slug}`, "_blank", "noopener") },
            ...(writable ? [{ label: "Duplicate", icon: <Copy size={14} />, onSelect: () => router.push(`/admin/products/new?from=${p.id}`) }] : []),
            ...(writable && p.status !== "archived" ? [{ type: "separator" as const }, { label: "Archive", danger: true, icon: <Archive size={14} />, onSelect: () => void archiveOne(p) }] : []),
          ]}
          empty={
            <EmptyState
              icon={<Package size={18} />}
              title={filtered ? "No products match these filters" : "No products yet"}
              description={filtered ? "Try a different search or clear the filters." : "Create your first product to start selling."}
              action={filtered ? <Button size="sm" onClick={reset}>Clear filters</Button> : writable ? <LinkButton size="sm" variant="primary" href="/admin/products/new">New product</LinkButton> : undefined}
            />
          }
        />
        <Pagination page={Number(state.page)} pageSize={Number(state.pageSize)} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} onPageSize={(s) => set({ pageSize: String(s) })} />
      </Card>
    </>
  );
}
