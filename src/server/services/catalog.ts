import "server-only";
import { and, asc, desc, eq, getTableColumns, inArray, ne, sql, type SQL } from "drizzle-orm";
import { getDb, type DbOrTx } from "../db/client";
import {
  categories,
  categoryTranslations,
  productImages,
  productTranslations,
  productVariants,
  products,
  variantTranslations,
} from "../db/schema";
import type { CategoryDTO, Localized, ProductDTO, ProductListDTO, SuggestionDTO, VariantDTO } from "@/lib/api-types";

export const SORTS = ["featured", "price-asc", "price-desc", "newest", "name"] as const;
export type SortKey = (typeof SORTS)[number];

export const MAX_LINE_QTY = 10;
const PLACEHOLDER_IMAGE = "/products/p1.jpg";

const loc = (rows: { locale: "fr" | "ar"; value: string }[], fallback = ""): Localized => {
  const fr = rows.find((r) => r.locale === "fr")?.value ?? fallback;
  const ar = rows.find((r) => r.locale === "ar")?.value ?? fr;
  return { fr, ar };
};

/** Escape LIKE metacharacters so user input is matched literally. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ------------------------------------------------------------ categories

export async function listCategories(db?: DbOrTx): Promise<CategoryDTO[]> {
  const d = db ?? (await getDb());
  const cats = await d
    .select({ id: categories.id, slug: categories.slug, image: categories.image })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.position), asc(categories.slug));
  if (cats.length === 0) return [];
  const tr = await d.select().from(categoryTranslations).where(inArray(categoryTranslations.categoryId, cats.map((c) => c.id)));
  return cats.map((c) => {
    const t = tr.filter((x) => x.categoryId === c.id);
    return {
      slug: c.slug,
      image: c.image,
      name: loc(t.map((x) => ({ locale: x.locale, value: x.name })), c.slug),
      short: loc(t.map((x) => ({ locale: x.locale, value: x.short })), c.slug),
      tagline: loc(t.map((x) => ({ locale: x.locale, value: x.tagline }))),
    };
  });
}

// ------------------------------------------------------------ hydration

type ProductRow = typeof products.$inferSelect & { categorySlug: string };

/** Batch-loads translations, variants and images for a set of products (4 queries total). */
export async function hydrateProducts(d: DbOrTx, rows: ProductRow[], withDetail = false): Promise<ProductDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [trs, vars, imgs] = await Promise.all([
    d.select().from(productTranslations).where(inArray(productTranslations.productId, ids)),
    d
      .select()
      .from(productVariants)
      .where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true)))
      .orderBy(asc(productVariants.position), asc(productVariants.price)),
    d.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.position)),
  ]);
  const vtr = vars.length
    ? await d.select().from(variantTranslations).where(inArray(variantTranslations.variantId, vars.map((v) => v.id)))
    : [];

  return rows.map((p) => {
    const t = trs.filter((x) => x.productId === p.id);
    const pick = <K extends keyof (typeof trs)[number]>(k: K) => t.map((x) => ({ locale: x.locale, value: String(x[k] ?? "") }));
    const pv = vars.filter((v) => v.productId === p.id);
    const base = pv[0]?.price ?? 0;
    const variants: VariantDTO[] = pv.map((v) => {
      const vt = vtr.filter((x) => x.variantId === v.id).map((x) => ({ locale: x.locale, value: x.label }));
      return {
        id: v.id,
        code: v.code,
        label: loc(vt, v.code),
        price: v.price,
        compareAt: v.compareAtPrice != null && v.compareAtPrice > v.price ? v.compareAtPrice : null,
        priceDelta: v.price - base,
        inStock: v.stock > 0,
        maxQty: Math.min(MAX_LINE_QTY, v.stock),
      };
    });
    const images = imgs.filter((i) => i.productId === p.id).map((i) => i.url);
    const dto: ProductDTO = {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.categorySlug,
      price: variants[0]?.price ?? 0,
      compareAt: variants[0]?.compareAt ?? null,
      image: images[0] ?? PLACEHOLDER_IMAGE,
      images: images.length ? images : [PLACEHOLDER_IMAGE],
      short: loc(pick("short")),
      variantTitle: loc(pick("variantTitle")),
      variants,
      rating: Number(p.ratingAvg),
      reviews: p.ratingCount,
      bestSeller: p.isBestSeller,
      isNew: p.isNew,
      featured: p.isFeatured,
      inStock: variants.some((v) => v.inStock),
    };
    if (withDetail) {
      const fr = t.find((x) => x.locale === "fr");
      const ar = t.find((x) => x.locale === "ar") ?? fr;
      dto.detail = {
        description: loc(pick("description")),
        specs: { fr: fr?.specs ?? [], ar: ar?.specs ?? [] },
        inTheBox: { fr: fr?.inTheBox ?? [], ar: ar?.inTheBox ?? [] },
      };
    }
    return dto;
  });
}

const productCols = getTableColumns(products);

function baseSelect(d: DbOrTx) {
  return d
    .select({ ...productCols, categorySlug: categories.slug })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId));
}

/**
 * The price shown on a product card: its default (first active, by position)
 * variant — the same one hydrateProducts() exposes as `price` and quick-add
 * puts in the cart. Price sorting must follow it, not the cheapest option,
 * or "price ascending" lists visibly out of order.
 */
const displayPrice = sql`(select v.price from product_variants v where v.product_id = ${products.id} and v.is_active order by v.position, v.price limit 1)`;

const ORDER_BY: Record<SortKey, SQL[]> = {
  featured: [desc(products.isBestSeller), desc(products.isNew), asc(products.position), asc(products.name)],
  "price-asc": [sql`${displayPrice} asc nulls last`, asc(products.name)],
  "price-desc": [sql`${displayPrice} desc nulls last`, asc(products.name)],
  newest: [desc(products.isNew), desc(products.createdAt), desc(products.ratingAvg)],
  name: [asc(products.name)],
};

function searchCondition(q: string): SQL {
  const pattern = `%${likeEscape(q.trim())}%`;
  return sql`(
    ${products.name} ilike ${pattern}
    or exists (select 1 from ${productTranslations} pt where pt.product_id = ${products.id} and (pt.short ilike ${pattern} or pt.description ilike ${pattern}))
    or exists (select 1 from ${categoryTranslations} ct where ct.category_id = ${products.categoryId} and ct.name ilike ${pattern})
  )`;
}

export interface ListQuery {
  category?: string | null;
  q?: string | null;
  sale?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

/** `maxPageSize` lets trusted server callers (cumulative "see more" pages) exceed the public API cap. */
export async function listProducts(query: ListQuery, db?: DbOrTx, maxPageSize = 96): Promise<ProductListDTO> {
  const d = db ?? (await getDb());
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, query.pageSize ?? 24));
  const conds: SQL[] = [eq(products.status, "active"), eq(categories.isActive, true)];
  if (query.category) conds.push(eq(categories.slug, query.category));
  if (query.sale) conds.push(eq(products.onSale, true));
  if (query.q && query.q.trim()) conds.push(searchCondition(query.q.slice(0, 100)));
  const where = and(...conds);

  const [rows, [{ count }]] = await Promise.all([
    baseSelect(d)
      .where(where)
      .orderBy(...ORDER_BY[query.sort ?? "featured"])
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    d
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where),
  ]);
  return { items: await hydrateProducts(d, rows), total: count, page, pageSize };
}

export async function getProductBySlug(slug: string, opts: { includeInactive?: boolean } = {}, db?: DbOrTx): Promise<ProductDTO | null> {
  const d = db ?? (await getDb());
  const conds: SQL[] = [eq(products.slug, slug)];
  if (!opts.includeInactive) conds.push(eq(products.status, "active"));
  const rows = await baseSelect(d).where(and(...conds)).limit(1);
  const [dto] = await hydrateProducts(d, rows, true);
  return dto ?? null;
}

export async function getProductsBySlugs(slugs: string[], db?: DbOrTx): Promise<ProductDTO[]> {
  if (slugs.length === 0) return [];
  const d = db ?? (await getDb());
  const rows = await baseSelect(d).where(and(inArray(products.slug, slugs.slice(0, 200)), eq(products.status, "active")));
  const list = await hydrateProducts(d, rows);
  const order = new Map(slugs.map((s, i) => [s, i]));
  return list.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
}

export async function relatedProducts(productId: string, categorySlug: string, limit = 8, db?: DbOrTx): Promise<ProductDTO[]> {
  const d = db ?? (await getDb());
  const rows = await baseSelect(d)
    .where(and(eq(categories.slug, categorySlug), eq(products.status, "active"), ne(products.id, productId)))
    .orderBy(...ORDER_BY.featured)
    .limit(limit);
  return hydrateProducts(d, rows);
}

/** Home rails — same selection rules the static storefront used. */
export async function homeRails(db?: DbOrTx): Promise<{ bestSellers: ProductDTO[]; newArrivals: ProductDTO[] }> {
  const d = db ?? (await getDb());
  const rows = await baseSelect(d).where(eq(products.status, "active")).orderBy(asc(products.position), asc(products.name)).limit(60);
  const all = await hydrateProducts(d, rows);
  const best = all.filter((p) => p.bestSeller);
  const fill = all.filter((p) => p.featured && !p.bestSeller);
  const bestSellers = [...best, ...fill].slice(0, 8);
  const taken = new Set(bestSellers.map((p) => p.slug));
  const fresh = all.filter((p) => p.isNew && !taken.has(p.slug));
  const rest = all.filter((p) => !p.isNew && !taken.has(p.slug));
  return { bestSellers, newArrivals: [...fresh, ...rest].slice(0, 8) };
}

export async function suggest(q: string, db?: DbOrTx): Promise<SuggestionDTO[]> {
  const term = q.trim().slice(0, 80);
  if (!term) return [];
  const d = db ?? (await getDb());
  const pattern = `%${likeEscape(term)}%`;
  const allCats = await listCategories(d);
  const cats = allCats.filter((c) =>
    [c.slug, c.name.fr, c.name.ar].some((s) => s.toLowerCase().includes(term.toLowerCase())),
  );
  const rows = await baseSelect(d)
    .where(
      and(
        eq(products.status, "active"),
        sql`(${products.name} ilike ${pattern} or exists (select 1 from ${productTranslations} pt where pt.product_id = ${products.id} and pt.short ilike ${pattern}))`,
      ),
    )
    .orderBy(...ORDER_BY.featured)
    .limit(8);
  const prods = await hydrateProducts(d, rows);
  const catMap = new Map(allCats.map((c) => [c.slug, c]));
  return [
    ...cats.map((c) => ({ kind: "category" as const, slug: c.slug, label: c.name, sub: c.tagline })),
    ...prods.map((p) => ({
      kind: "product" as const,
      slug: p.slug,
      label: p.name,
      sub: catMap.get(p.category)?.name ?? { fr: p.category, ar: p.category },
      price: p.price,
      image: p.image,
    })),
  ].slice(0, 10);
}

/** Recompute denormalized pricing flags after variant changes. */
export async function refreshProductPricing(d: DbOrTx, productId: string) {
  await d.execute(sql`
    update products p set
      min_price = coalesce((select min(v.price) from product_variants v where v.product_id = p.id and v.is_active), 0),
      on_sale = exists (select 1 from product_variants v where v.product_id = p.id and v.is_active and v.compare_at_price > v.price),
      updated_at = now()
    where p.id = ${productId}`);
}
