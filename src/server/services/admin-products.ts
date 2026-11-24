import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { categories, categoryTranslations, products } from "../db/schema";
import { AppError } from "../lib/errors";
import { audit, type AuditActor } from "./audit";
import { likeEscape } from "./catalog";
import type { Locale } from "@/lib/api-types";

/*
 * Admin product listing, bulk merchandising and category administration.
 * Single-product create/update lives in admin-catalog.ts.
 */

/** A variant at or below this many units counts as low stock (dashboard, filters). */
export const LOW_STOCK = 5;

export type ProductSort = "updated" | "created" | "name" | "price" | "stock" | "rating";
export interface AdminProductQuery {
  search?: string;
  status?: "draft" | "active" | "archived";
  category?: string;
  stock?: "in" | "low" | "out";
  flag?: "featured" | "bestSeller" | "new" | "sale";
  sort?: ProductSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

const totalStockSql = sql<number>`coalesce((select sum(v.stock) from product_variants v where v.product_id = "products"."id" and v.is_active), 0)::int`;

export async function adminListProducts(q: AdminProductQuery) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(products.status, q.status));
  if (q.category) conds.push(eq(categories.slug, q.category));
  if (q.flag === "featured") conds.push(eq(products.isFeatured, true));
  if (q.flag === "bestSeller") conds.push(eq(products.isBestSeller, true));
  if (q.flag === "new") conds.push(eq(products.isNew, true));
  if (q.flag === "sale") conds.push(eq(products.onSale, true));
  if (q.stock === "out") conds.push(sql`${totalStockSql} = 0`);
  if (q.stock === "in") conds.push(sql`${totalStockSql} > 0`);
  if (q.stock === "low") {
    conds.push(sql`${totalStockSql} > 0`);
    conds.push(sql`exists (select 1 from product_variants v where v.product_id = "products"."id" and v.is_active and v.stock <= ${LOW_STOCK})`);
  }
  if (q.search) {
    const pattern = `%${likeEscape(q.search)}%`;
    conds.push(
      or(
        ilike(products.name, pattern),
        ilike(products.slug, pattern),
        sql`exists (select 1 from product_variants v where v.product_id = "products"."id" and v.sku ilike ${pattern})`,
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  const sortCol = {
    updated: products.updatedAt,
    created: products.createdAt,
    name: products.name,
    price: products.minPrice,
    stock: totalStockSql,
    rating: products.ratingAvg,
  }[q.sort ?? "updated"];
  const order = (q.dir ?? (q.sort === "name" ? "asc" : "desc")) === "asc" ? asc(sortCol) : desc(sortCol);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        status: products.status,
        categorySlug: categories.slug,
        isFeatured: products.isFeatured,
        isBestSeller: products.isBestSeller,
        isNew: products.isNew,
        onSale: products.onSale,
        minPrice: products.minPrice,
        ratingAvg: products.ratingAvg,
        ratingCount: products.ratingCount,
        totalStock: totalStockSql,
        variantCount: sql<number>`(select count(*)::int from product_variants v where v.product_id = "products"."id")`,
        lowVariants: sql<number>`(select count(*)::int from product_variants v where v.product_id = "products"."id" and v.is_active and v.stock <= ${LOW_STOCK})`,
        image: sql<string | null>`(select coalesce(i.variants->>'thumb', i.url) from product_images i where i.product_id = "products"."id" order by i.position limit 1)`,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where)
      .orderBy(order, asc(products.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where),
  ]);
  return { items: rows, total, page, pageSize };
}

export interface BulkProductPatch {
  status?: "draft" | "active" | "archived";
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
  categorySlug?: string;
}

/** Status, merchandising flags or category for many products at once (one transaction, audited per product). */
export async function bulkUpdateProducts(ids: string[], patch: BulkProductPatch, actor: AuditActor) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const set: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
    if (patch.status) set.status = patch.status;
    if (patch.isFeatured !== undefined) set.isFeatured = patch.isFeatured;
    if (patch.isBestSeller !== undefined) set.isBestSeller = patch.isBestSeller;
    if (patch.isNew !== undefined) set.isNew = patch.isNew;
    if (patch.categorySlug) {
      const [c] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, patch.categorySlug));
      if (!c) throw new AppError("VALIDATION", "Unknown category", { fields: { categorySlug: "unknown" } });
      set.categoryId = c.id;
    }
    const before = await tx
      .select({ id: products.id, status: products.status, slug: products.slug })
      .from(products)
      .where(inArray(products.id, ids))
      .orderBy(asc(products.id))
      .for("update");
    if (before.length === 0) throw new AppError("NOT_FOUND", "No matching products");
    await tx.update(products).set(set).where(inArray(products.id, before.map((b) => b.id)));
    for (const b of before) {
      await audit(tx, actor, "product.bulk_update", { type: "product", id: b.id }, { before: { status: b.status }, after: patch });
    }
    return { updated: before.length, slugs: before.map((b) => b.slug) };
  });
}

// ------------------------------------------------------------ categories

export async function adminListCategories() {
  const db = await getDb();
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      parentId: categories.parentId,
      position: categories.position,
      image: categories.image,
      isActive: categories.isActive,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      productCount: sql<number>`(select count(*)::int from products p where p.category_id = "categories"."id")`,
      activeProductCount: sql<number>`(select count(*)::int from products p where p.category_id = "categories"."id" and p.status = 'active')`,
    })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.slug));
  const tr = rows.length ? await db.select().from(categoryTranslations).where(inArray(categoryTranslations.categoryId, rows.map((r) => r.id))) : [];
  return rows.map((r) => {
    const copy = (l: Locale) => {
      const t = tr.find((x) => x.categoryId === r.id && x.locale === l);
      return t ? { name: t.name, short: t.short, tagline: t.tagline } : null;
    };
    return { ...r, parentSlug: rows.find((p) => p.id === r.parentId)?.slug ?? null, translations: { fr: copy("fr"), ar: copy("ar") } };
  });
}

/** Only empty categories can be deleted; otherwise deactivate them. */
export async function deleteCategory(slug: string, actor: AuditActor) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(categories).where(eq(categories.slug, slug)).for("update");
    if (!c) throw new AppError("NOT_FOUND", "Category not found");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.categoryId, c.id));
    if (n > 0) {
      throw new AppError("CONFLICT", `This category still has ${n} product(s). Move them or deactivate the category instead.`, { reason: "has_products" });
    }
    const [{ kids }] = await tx.select({ kids: sql<number>`count(*)::int` }).from(categories).where(eq(categories.parentId, c.id));
    if (kids > 0) throw new AppError("CONFLICT", "This category has sub-categories.", { reason: "has_children" });
    await tx.delete(categories).where(eq(categories.id, c.id));
    await audit(tx, actor, "category.delete", { type: "category", id: c.id }, { before: { slug } });
  });
}
