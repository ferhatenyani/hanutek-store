"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { categories, products, categoryBySlug, variantPrice, type CategorySlug } from "@/lib/products";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product-card";
import { NavTransition } from "@/components/nav-transition";
import { BlurFade } from "@/components/ui/blur-fade";
import { Select } from "@/components/ui/primitives";
import { categoryIcons } from "@/components/icons";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

export function ProductsBrowser() {
  const params = useSearchParams();
  const router = useRouter();

  const rawCat = params.get("category");
  const category = categories.some((c) => c.slug === rawCat) ? (rawCat as CategorySlug) : null;
  const rawSort = params.get("sort");
  const sort: SortKey = SORTS.some((s) => s.value === rawSort) ? (rawSort as SortKey) : "featured";

  const hrefFor = (cat: CategorySlug | null, s: SortKey) => {
    const q = new URLSearchParams();
    if (cat) q.set("category", cat);
    if (s !== "featured") q.set("sort", s);
    const str = q.toString();
    return str ? `/products?${str}` : "/products";
  };

  const list = (() => {
    const filtered = category ? products.filter((p) => p.category === category) : [...products];
    switch (sort) {
      case "price-asc":
        return filtered.sort((a, b) => variantPrice(a, a.variants[0].id) - variantPrice(b, b.variants[0].id));
      case "price-desc":
        return filtered.sort((a, b) => variantPrice(b, b.variants[0].id) - variantPrice(a, a.variants[0].id));
      case "name":
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return filtered.sort(
          (a, b) => Number(b.bestSeller ?? false) - Number(a.bestSeller ?? false) || Number(b.isNew ?? false) - Number(a.isNew ?? false),
        );
    }
  })();

  const activeCategory = category ? categoryBySlug[category] : null;

  return (
    <NavTransition>
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <BlurFade duration={0.4}>
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/" transitionTypes={["nav-back"]} className="flex items-center gap-1 transition-colors hover:text-foreground">
              <ChevronLeft size={13} /> Home
            </Link>
            <span className="text-faint">/</span>
            <span className="text-foreground">All products</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {activeCategory ? activeCategory.name : "All products"}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {activeCategory ? activeCategory.tagline : "Every piece of gear in the catalog, road-tested and ready to ship."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-faint">
                {list.length} {list.length === 1 ? "product" : "products"}
              </span>
              <Select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => router.replace(hrefFor(category, e.target.value as SortKey), { scroll: false })}
                className="h-10 w-48 text-[13px]"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </BlurFade>

        <BlurFade delay={0.1} duration={0.4}>
          <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
            <Link
              href={hrefFor(null, sort)}
              transitionTypes={["nav-forward"]}
              scroll={false}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-full border px-4 text-[13px] font-medium transition-colors",
                !category
                  ? "border-foreground bg-foreground text-background"
                  : "border-line bg-background text-muted hover:border-foreground/30 hover:text-foreground",
              )}
            >
              All
            </Link>
            {categories.map((c) => {
              const Icon = categoryIcons[c.slug];
              const active = category === c.slug;
              return (
                <Link
                  key={c.slug}
                  href={hrefFor(c.slug, sort)}
                  transitionTypes={["nav-forward"]}
                  scroll={false}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-line bg-background text-muted hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  <Icon size={14} />
                  {c.name}
                </Link>
              );
            })}
          </div>
        </BlurFade>

        <div key={`${category ?? "all"}-${sort}`} className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          {list.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} priority={i < 4} />
          ))}
        </div>
      </div>
    </NavTransition>
  );
}