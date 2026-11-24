"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search, X } from "lucide-react";
import type { CategoryDTO, ProductDTO } from "@/lib/api-types";
import { tr } from "@/lib/catalog-client";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product-card";
import { SelectMenu } from "@/components/ui/select-menu";
import { categoryIcon } from "@/components/icons";
import { useI18n } from "@/i18n";
import { NavTransition } from "@/components/nav-transition";

type SortKey = "featured" | "price-asc" | "price-desc" | "newest" | "name";
const SORT_VALUES: SortKey[] = ["featured", "price-asc", "price-desc", "newest", "name"];

const chipBase = "flex h-9 shrink-0 cursor-pointer items-center rounded-full border px-4 text-[13px] font-medium transition-colors duration-150";
const chipActive = "border-foreground bg-foreground text-background";
const chipIdle = "border-line bg-surface text-muted hover:border-foreground/30 hover:text-foreground";

export interface BrowserQuery {
  category: string | null;
  sort: SortKey;
  sale: boolean;
  q: string;
  page: number;
}

export function ProductsBrowser({
  items,
  total,
  categories,
  query,
  hasMore,
}: {
  items: ProductDTO[];
  total: number;
  categories: CategoryDTO[];
  query: BrowserQuery;
  hasMore: boolean;
}) {
  const { t, m, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { category, sort, sale, q } = query;
  const navigate = (href: string) => startTransition(() => router.replace(href, { scroll: false }));

  const sortLabels: Record<SortKey, string> = {
    featured: m.listing.sortFeatured,
    "price-asc": m.listing.sortPriceAsc,
    "price-desc": m.listing.sortPriceDesc,
    newest: m.listing.sortNewest,
    name: m.listing.sortName,
  };

  const hrefFor = (cat: string | null, s: SortKey, onSale: boolean, search = q, page = 1) => {
    const qp = new URLSearchParams();
    if (cat) qp.set("category", cat);
    if (s !== "featured") qp.set("sort", s);
    if (onSale) qp.set("sale", "1");
    if (search) qp.set("q", search);
    if (page > 1) qp.set("page", String(page));
    const str = qp.toString();
    return str ? `/products?${str}` : "/products";
  };

  const activeCategory = category ? categories.find((c) => c.slug === category) ?? null : null;
  const title = activeCategory ? tr(activeCategory.name, locale) : m.listing.title;
  const sub = activeCategory ? tr(activeCategory.tagline, locale) : m.listing.sub;
  const hasFilters = category != null || sale || q.length > 0;

  return (
    <NavTransition>
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label={m.common.breadcrumb}>
        <Link href="/" transitionTypes={["nav-back"]} className="flex items-center gap-1 transition-colors duration-150 hover:text-foreground">
          <ChevronLeft size={13} className="rtl:-scale-x-100" /> {m.nav.home}
        </Link>
        <span className="text-faint">/</span>
        <span className="text-foreground">{title}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{sub}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[11px] text-muted">
            {t("listing.resultsCount", { n: total })}
          </span>
          <SelectMenu
            ariaLabel={m.listing.sortBy}
            value={sort}
            options={SORT_VALUES.map((s) => ({ value: s, label: sortLabels[s] }))}
            triggerPrefix={`${m.listing.sortBy}:`}
            onChange={(v) => navigate(hrefFor(category, v as SortKey, sale))}
            className="w-44 md:w-56"
          />
        </div>
      </div>

      {/* active search term chip */}
      {q && (
        <div className="mt-5 flex items-center gap-2 text-sm">
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-foreground bg-foreground px-4 text-[13px] font-medium text-background">
            <Search size={13} aria-hidden />
            <span className="max-w-48 truncate">{q}</span>
            <button
              type="button"
              aria-label={m.common.clear}
              onClick={() => navigate(hrefFor(category, sort, sale, ""))}
              className="cursor-pointer rounded-full p-0.5 hover:bg-background/20"
            >
              <X size={13} />
            </button>
          </span>
        </div>
      )}

      <div className="no-scrollbar mt-6 flex items-center gap-2 overflow-x-auto pb-1 md:mt-8" role="tablist" aria-label={m.listing.category}>
        <Link
          href={hrefFor(null, sort, sale)}
          scroll={false}
          className={cn(chipBase, !category ? chipActive : chipIdle)}
        >
          {m.listing.all}
        </Link>
        {categories.map((c) => {
          const Icon = categoryIcon(c.slug);
          const active = category === c.slug;
          return (
            <Link
              key={c.slug}
              href={hrefFor(c.slug, sort, sale)}
              scroll={false}
              className={cn(chipBase, "gap-2", active ? chipActive : chipIdle)}
            >
              <Icon size={14} />
              {tr(c.short, locale)}
            </Link>
          );
        })}
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
        <button
          type="button"
          aria-pressed={sale}
          onClick={() => navigate(hrefFor(category, sort, !sale))}
          className={cn(
            chipBase,
            "gap-2",
            sale ? "border-sale bg-sale text-white" : "border-line bg-surface text-muted hover:border-foreground/30 hover:text-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", sale ? "bg-white" : "bg-sale")} aria-hidden />
          {m.listing.badge}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 text-[12px] font-medium text-muted transition-colors duration-150 hover:text-foreground"
          >
            <X size={13} />
            {m.listing.clearFilters}
          </button>
        )}
      </div>

      {items.length > 0 ? (
        <>
          <div
            key={`${category ?? "all"}-${sort}-${sale ? "sale" : "all"}-${q}`}
            aria-busy={pending}
            className={cn("product-grid mt-7 md:mt-8 transition-opacity duration-200", pending && "opacity-60")}
          >
            {items.map((p, i) => (
              <ProductCard key={p.slug} product={p} priority={i < 4} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-10 flex justify-center">
              <Link
                href={hrefFor(category, sort, sale, q, query.page + 1)}
                scroll={false}
                replace
                className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-6 text-[13px] font-semibold text-foreground transition-colors duration-150 hover:border-foreground/30"
              >
                {m.common.seeMore}
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="mt-10 flex flex-col items-center rounded-card border border-line bg-surface px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-muted">
            <Search size={20} />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-foreground">{m.listing.emptyTitle}</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{m.listing.emptyBody}</p>
          <Link
            href="/products"
            className="mt-6 flex h-11 items-center rounded-full bg-accent px-6 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-accent-ink"
          >
            {m.listing.clearFilters}
          </Link>
        </div>
      )}
    </div>
    </NavTransition>
  );
}
