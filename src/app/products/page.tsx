import type { Metadata } from "next";
import { cachedCategories, cachedProductList } from "@/server/queries";
import { SORTS, type SortKey } from "@/server/services/catalog";
import { ProductsBrowser } from "./browser";

export const metadata: Metadata = { title: "All products" };

const PAGE = 24;

/**
 * Catalogue listing. Filters live in the URL (shareable, back/forward-safe)
 * and are resolved on the server: category, sale, search, sort and "see more"
 * (`page` = how many pages are shown).
 */
export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const categories = await cachedCategories();

  const rawCat = one(sp.category);
  const category = categories.some((c) => c.slug === rawCat) ? rawCat! : null;
  const rawSort = one(sp.sort);
  const sort: SortKey = SORTS.includes(rawSort as SortKey) ? (rawSort as SortKey) : "featured";
  const sale = one(sp.sale) === "1";
  const q = (one(sp.q) ?? "").trim().slice(0, 100);
  const page = Math.min(20, Math.max(1, Math.floor(Number(one(sp.page))) || 1));

  const result = await cachedProductList({ category, sort, sale, q, page: 1, pageSize: PAGE * page });
  return (
    <ProductsBrowser
      items={result.items}
      total={result.total}
      categories={categories}
      query={{ category, sort, sale, q, page }}
      hasMore={result.total > PAGE * page && page < 20}
    />
  );
}
