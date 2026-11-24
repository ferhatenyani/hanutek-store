import "server-only";
import { unstable_cache } from "next/cache";
import { getProductBySlug, homeRails, listCategories, listProducts, relatedProducts, type ListQuery } from "./services/catalog";
import { CATALOG_TAG } from "./lib/route-helpers";

/*
 * Cached catalogue reads for Server Components. Entries are tagged
 * "catalog": admin writes, reviews and checkouts (stock) call
 * revalidateTag("catalog") so pages never serve stale prices/stock for long.
 * The short revalidate window is a safety net for out-of-band DB edits.
 */
const opts = { tags: [CATALOG_TAG], revalidate: 300 };

export const cachedHomeRails = unstable_cache(() => homeRails(), ["home-rails"], opts);
export const cachedCategories = unstable_cache(() => listCategories(), ["categories"], opts);
export const cachedProduct = unstable_cache((slug: string) => getProductBySlug(slug), ["product"], opts);
export const cachedRelated = unstable_cache((id: string, category: string) => relatedProducts(id, category), ["related"], opts);
export const cachedProductList = unstable_cache((q: ListQuery) => listProducts(q, undefined, 24 * 20), ["product-list"], opts);
