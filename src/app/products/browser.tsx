"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Search, X } from "lucide-react";
import { categories, products, categoryBySlug, variantPrice, type CategorySlug } from "@/lib/products";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product-card";
import { SelectMenu } from "@/components/ui/select-menu";
import { categoryIcons } from "@/components/icons";
import { useI18n } from "@/i18n";
import { NavTransition } from "@/components/nav-transition";

type SortKey = "featured" | "price-asc" | "price-desc" | "newest" | "name";
const SORT_VALUES: SortKey[] = ["featured", "price-asc", "price-desc", "newest", "name"];

const chipBase = "flex h-9 shrink-0 cursor-pointer items-center rounded-full border px-4 text-[13px] font-medium transition-colors duration-150";
const chipActive = "border-foreground bg-foreground text-background";
const chipIdle = "border-line bg-surface text-muted hover:border-foreground/30 hover:text-foreground";

export function ProductsBrowser() {
  const { t, m } = useI18n();
  const params = useSearchParams();
  const router = useRouter();

  const rawCat = params.get("category");
  const category = categories.some((c) => c.slug === rawCat) ? (rawCat as CategorySlug) : null;
  const rawSort = params.get("sort");
  const sort: SortKey = SORT_VALUES.includes(rawSort as SortKey) ? (rawSort as SortKey) : "featured";
  const sale = params.get("sale") === "1";
  const q = params.get("q")?.trim() ?? "";

  const sortLabels: Record<SortKey, string> = {
    featured: m.listing.sortFeatured,
    "price-asc": m.listing.sortPriceAsc,
    "price-desc": m.listing.sortPriceDesc,
    newest: m.listing.sortNewest,
    name: m.listing.sortName,
  };

  const hrefFor = (cat: CategorySlug | null, s: SortKey, onSale: boolean, query = q) => {
    const qp = new URLSearchParams();
    if (cat) qp.set("category", cat);
    if (s !== "featured") qp.set("sort", s);
    if (onSale) qp.set("sale", "1");
    if (query) qp.set("q", query);
    const str = qp.toString();
    return str ? `/products?${str}` : "/products";
  };

  const list = (() => {
    let filtered = category ? products.filter((p) => p.category === category) : [...products];
    if (sale) filtered = filtered.filter((p) => p.compareAt != null && p.compareAt > variantPrice(p, p.variants[0].id));
    if (q) {
      const s = q.toLowerCase();
      filtered = filtered.filter((p) => `${p.name} ${p.short} ${m.categories[p.category].name}`.toLowerCase().includes(s));
    }
    switch (sort) {
      case "price-asc":
        return filtered.sort((a, b) => variantPrice(a, a.variants[0].id) - variantPrice(b, b.variants[0].id));
      case "price-desc":
        return filtered.sort((a, b) => variantPrice(b, b.variants[0].id) - variantPrice(a, a.variants[0].id));
      case "newest":
        return filtered.sort((a, b) => Number(b.isNew ?? false) - Number(a.isNew ?? false) || b.rating - a.rating);
      case "name":
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return filtered.sort(
          (a, b) => Number(b.bestSeller ?? false) - Number(a.bestSeller ?? false) || Number(b.isNew ?? false) - Number(a.isNew ?? false),
        );
    }
  })();

  const activeCategory = category ? categoryBySlug[category] : null;
  const title = activeCategory ? m.categories[category!].name : m.listing.title;
  const sub = activeCategory ? m.categories[category!].tagline : m.listing.sub;
  const hasFilters = category != null || sale || q.length > 0;

  return (
    <NavTransition>
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label={m.nav.home}>
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
            {t("listing.resultsCount", { n: list.length })}
          </span>
          <SelectMenu
            ariaLabel={m.listing.sortBy}
            value={sort}
            options={SORT_VALUES.map((s) => ({ value: s, label: sortLabels[s] }))}
            triggerPrefix={`${m.listing.sortBy}:`}
            onChange={(v) => router.replace(hrefFor(category, v as SortKey, sale), { scroll: false })}
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
              onClick={() => router.replace(hrefFor(category, sort, sale, ""), { scroll: false })}
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
          const Icon = categoryIcons[c.slug];
          const active = category === c.slug;
          return (
            <Link
              key={c.slug}
              href={hrefFor(c.slug, sort, sale)}
              scroll={false}
              className={cn(chipBase, "gap-2", active ? chipActive : chipIdle)}
            >
              <Icon size={14} />
              {m.categories[c.slug].short}
            </Link>
          );
        })}
        <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
        <button
          type="button"
          aria-pressed={sale}
          onClick={() => router.replace(hrefFor(category, sort, !sale), { scroll: false })}
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
            onClick={() => router.replace("/products", { scroll: false })}
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 text-[12px] font-medium text-muted transition-colors duration-150 hover:text-foreground"
          >
            <X size={13} />
            {m.listing.clearFilters}
          </button>
        )}
      </div>

      {list.length > 0 ? (
        <div
          key={`${category ?? "all"}-${sort}-${sale ? "sale" : "all"}-${q}`}
          className="product-grid mt-7 md:mt-8"
        >
          {list.map((p, i) => (
            <ProductCard key={p.slug} product={p} priority={i < 4} />
          ))}
        </div>
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
