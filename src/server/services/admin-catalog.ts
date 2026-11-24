import "server-only";
import { and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Tx } from "../db/client";
import {
  categories,
  categoryTranslations,
  inventoryMovements,
  productImages,
  productTranslations,
  productVariants,
  products,
  variantTranslations,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { audit, type AuditActor } from "./audit";
import { getProductBySlug, hydrateProducts, likeEscape, refreshProductPricing } from "./catalog";
import { deleteStoredImage, processImageUpload } from "./media";
import type { Locale } from "@/lib/api-types";

/*
 * Admin catalogue management. Every mutation runs in a transaction and
 * writes an audit log entry. Inputs are validated by zod in the route layer.
 */

export interface ProductTranslationInput {
  short: string;
  description: string;
  variantTitle?: string;
  specs?: [string, string][];
  inTheBox?: string[];
}

export interface VariantInput {
  id?: string;
  code: string;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  stock?: number;
  attributes?: Record<string, string>;
  position?: number;
  isActive?: boolean;
  labels: Record<Locale, string>;
}

export interface ProductInput {
  slug: string;
  name: string;
  categorySlug: string;
  status?: "draft" | "active" | "archived";
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
  position?: number;
  translations: Partial<Record<Locale, ProductTranslationInput>> & { fr: ProductTranslationInput };
  variants?: VariantInput[];
}

async function categoryId(tx: Tx, slug: string) {
  const [c] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  if (!c) throw new AppError("VALIDATION", "Unknown category", { fields: { categorySlug: "unknown" } });
  return c.id;
}

async function upsertTranslations(tx: Tx, productId: string, translations: ProductInput["translations"]) {
  for (const [locale, t] of Object.entries(translations) as [Locale, ProductTranslationInput | undefined][]) {
    if (!t) continue;
    const values = {
      short: t.short,
      description: t.description,
      variantTitle: t.variantTitle ?? "",
      specs: t.specs ?? [],
      inTheBox: t.inTheBox ?? [],
    };
    await tx
      .insert(productTranslations)
      .values({ productId, locale, ...values })
      .onConflictDoUpdate({ target: [productTranslations.productId, productTranslations.locale], set: values });
  }
}

async function upsertVariant(tx: Tx, productId: string, v: VariantInput, actor: AuditActor) {
  const values = {
    code: v.code,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? null,
    attributes: v.attributes ?? {},
    position: v.position ?? 0,
    isActive: v.isActive ?? true,
  };
  let variantId = v.id;
  if (variantId) {
    const [row] = await tx
      .update(productVariants)
      .set(values)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
      .returning({ id: productVariants.id });
    if (!row) throw new AppError("NOT_FOUND", "Variant not found");
  } else {
    const stock = v.stock ?? 0;
    const [row] = await tx.insert(productVariants).values({ ...values, productId, stock }).returning({ id: productVariants.id });
    variantId = row.id;
    if (stock > 0) {
      await tx.insert(inventoryMovements).values({ variantId, delta: stock, stockAfter: stock, reason: "restock", actorId: actor.id, note: "Initial stock" });
    }
  }
  for (const [locale, label] of Object.entries(v.labels) as [Locale, string][]) {
    await tx
      .insert(variantTranslations)
      .values({ variantId, locale, label })
      .onConflictDoUpdate({ target: [variantTranslations.variantId, variantTranslations.locale], set: { label } });
  }
  return variantId;
}

export function mapUnique(err: unknown): never {
  const msg = String((err as { message?: string })?.message ?? "") + String((err as { cause?: { message?: string } })?.cause?.message ?? "");
  if (msg.includes("products_slug_uq")) throw new AppError("CONFLICT", "Slug already in use", { fields: { slug: "taken" } });
  if (msg.includes("variants_sku_uq")) throw new AppError("CONFLICT", "SKU already in use", { fields: { sku: "taken" } });
  if (msg.includes("variants_product_code_uq")) throw new AppError("CONFLICT", "Variant code already used on this product", { fields: { code: "taken" } });
  if (msg.includes("categories_slug_uq")) throw new AppError("CONFLICT", "Slug already in use", { fields: { slug: "taken" } });
  if (msg.includes("promotions_code_uq")) throw new AppError("CONFLICT", "Code already in use", { fields: { code: "taken" } });
  throw err;
}

export async function createProduct(input: ProductInput, actor: AuditActor) {
  const db = await getDb();
  const id = await db
    .transaction(async (tx) => {
      const [p] = await tx
        .insert(products)
        .values({
          slug: input.slug,
          name: input.name,
          categoryId: await categoryId(tx, input.categorySlug),
          status: input.status ?? "draft",
          isFeatured: input.isFeatured ?? false,
          isBestSeller: input.isBestSeller ?? false,
          isNew: input.isNew ?? false,
          position: input.position ?? 0,
        })
        .returning();
      await upsertTranslations(tx, p.id, input.translations);
      for (const v of input.variants ?? []) await upsertVariant(tx, p.id, v, actor);
      await refreshProductPricing(tx, p.id);
      await audit(tx, actor, "product.create", { type: "product", id: p.id }, { after: input });
      return p.id;
    })
    .catch(mapUnique);
  return adminGetProduct(id);
}

export async function updateProduct(productId: string, input: Partial<ProductInput>, actor: AuditActor) {
  const db = await getDb();
  await db
    .transaction(async (tx) => {
      const [before] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
      if (!before) throw new AppError("NOT_FOUND", "Product not found");
      const set: Partial<typeof products.$inferInsert> = {};
      if (input.slug !== undefined) set.slug = input.slug;
      if (input.name !== undefined) set.name = input.name;
      if (input.categorySlug !== undefined) set.categoryId = await categoryId(tx, input.categorySlug);
      if (input.status !== undefined) set.status = input.status;
      if (input.isFeatured !== undefined) set.isFeatured = input.isFeatured;
      if (input.isBestSeller !== undefined) set.isBestSeller = input.isBestSeller;
      if (input.isNew !== undefined) set.isNew = input.isNew;
      if (input.position !== undefined) set.position = input.position;
      if (Object.keys(set).length) await tx.update(products).set(set).where(eq(products.id, productId));
      if (input.translations) await upsertTranslations(tx, productId, input.translations);
      for (const v of input.variants ?? []) await upsertVariant(tx, productId, v, actor);
      await refreshProductPricing(tx, productId);
      await audit(tx, actor, "product.update", { type: "product", id: productId }, { before, after: input });
    })
    .catch(mapUnique);
  return adminGetProduct(productId);
}

/** Products referenced by orders are archived rather than deleted (history stays intact via snapshots either way). */
export async function archiveProduct(productId: string, actor: AuditActor) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.update(products).set({ status: "archived" }).where(eq(products.id, productId)).returning({ id: products.id });
    if (!row) throw new AppError("NOT_FOUND", "Product not found");
    await audit(tx, actor, "product.archive", { type: "product", id: productId });
  });
}

export async function adminGetProduct(productId: string) {
  const db = await getDb();
  const [p] = await db
    .select({ slug: products.slug, status: products.status, position: products.position, createdAt: products.createdAt, updatedAt: products.updatedAt })
    .from(products)
    .where(eq(products.id, productId));
  if (!p) throw new AppError("NOT_FOUND", "Product not found");
  const dto = await getProductBySlug(p.slug, { includeInactive: true }, db);
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(asc(productVariants.position));
  const images = await db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position));
  return {
    ...dto!,
    status: p.status,
    position: p.position,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    adminVariants: variants.map((v) => ({
      id: v.id,
      code: v.code,
      sku: v.sku,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      stock: v.stock,
      isActive: v.isActive,
      attributes: v.attributes,
      position: v.position,
    })),
    adminImages: images.map((i) => ({ id: i.id, url: i.url, variants: i.variants, alt: i.alt, position: i.position, width: i.width, height: i.height })),
  };
}

export async function adminListProducts(q: { search?: string; status?: "draft" | "active" | "archived"; category?: string; page?: number; pageSize?: number }) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(products.status, q.status));
  if (q.category) conds.push(eq(categories.slug, q.category));
  if (q.search) {
    const pattern = `%${likeEscape(q.search)}%`;
    conds.push(
      or(
        ilike(products.name, pattern),
        ilike(products.slug, pattern),
        sql`exists (select 1 from product_variants v where v.product_id = ${products.id} and v.sku ilike ${pattern})`,
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select({ ...getTableColumns(products), categorySlug: categories.slug })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(desc(products.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where);
  const hydrated = await hydrateProducts(db, rows);
  const stock = rows.length
    ? await db
        .select({ productId: productVariants.productId, stock: sql<number>`sum(${productVariants.stock})::int` })
        .from(productVariants)
        .where(inArray(productVariants.productId, rows.map((r) => r.id)))
        .groupBy(productVariants.productId)
    : [];
  return {
    items: hydrated.map((h, i) => ({ ...h, status: rows[i].status, totalStock: stock.find((s) => s.productId === h.id)?.stock ?? 0 })),
    total,
    page,
    pageSize,
  };
}

// ------------------------------------------------------------ inventory

export async function adjustStock(
  variantId: string,
  input: { delta?: number; set?: number; reason: "adjustment" | "restock" | "return"; note?: string | null },
  actor: AuditActor,
) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for("update");
    if (!v) throw new AppError("NOT_FOUND", "Variant not found");
    const next = input.set !== undefined ? input.set : v.stock + (input.delta ?? 0);
    if (next < 0) throw new AppError("VALIDATION", "Stock cannot go below zero", { fields: { delta: "negative_stock" } });
    const delta = next - v.stock;
    await tx.update(productVariants).set({ stock: next }).where(eq(productVariants.id, variantId));
    await tx.insert(inventoryMovements).values({ variantId, delta, stockAfter: next, reason: input.reason, actorId: actor.id, note: input.note ?? null });
    await audit(tx, actor, "inventory.adjust", { type: "variant", id: variantId }, { before: { stock: v.stock }, after: { stock: next, reason: input.reason } });
    return { variantId, stock: next };
  });
}

export async function stockHistory(variantId: string, limit = 50) {
  const db = await getDb();
  return db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, variantId)).orderBy(desc(inventoryMovements.createdAt)).limit(limit);
}

// ------------------------------------------------------------ images

export async function addProductImage(productId: string, file: Buffer, alt: string | null, actor: AuditActor) {
  const db = await getDb();
  const [p] = await db.select({ id: products.id, slug: products.slug }).from(products).where(eq(products.id, productId));
  if (!p) throw new AppError("NOT_FOUND", "Product not found");
  const processed = await processImageUpload(file, `products/${p.slug}`);
  try {
    return await db.transaction(async (tx) => {
      const [{ max }] = await tx
        .select({ max: sql<number>`coalesce(max(${productImages.position}), -1)::int` })
        .from(productImages)
        .where(eq(productImages.productId, productId));
      const [img] = await tx
        .insert(productImages)
        .values({ productId, url: processed.url, variants: processed.variants, storageKey: processed.storageKey, width: processed.width, height: processed.height, alt, position: max + 1 })
        .returning();
      await audit(tx, actor, "product.image.add", { type: "product", id: productId }, { after: { imageId: img.id, url: img.url } });
      return img;
    });
  } catch (err) {
    await deleteStoredImage(processed.storageKey); // no orphaned files
    throw err;
  }
}

export async function removeProductImage(productId: string, imageId: string, actor: AuditActor) {
  const db = await getDb();
  const img = await db.transaction(async (tx) => {
    const [row] = await tx.delete(productImages).where(and(eq(productImages.id, imageId), eq(productImages.productId, productId))).returning();
    if (!row) throw new AppError("NOT_FOUND", "Image not found");
    await audit(tx, actor, "product.image.remove", { type: "product", id: productId }, { before: { imageId, url: row.url } });
    return row;
  });
  await deleteStoredImage(img.storageKey);
}

export async function reorderImages(productId: string, orderedIds: string[], actor: AuditActor) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx.update(productImages).set({ position: i }).where(and(eq(productImages.id, id), eq(productImages.productId, productId)));
    }
    await audit(tx, actor, "product.image.reorder", { type: "product", id: productId }, { after: orderedIds });
  });
}

// ------------------------------------------------------------ categories

export interface CategoryInput {
  slug: string;
  position?: number;
  image?: string | null;
  isActive?: boolean;
  parentSlug?: string | null;
  translations: Partial<Record<Locale, { name: string; short: string; tagline?: string }>> & { fr: { name: string; short: string; tagline?: string } };
}

export async function upsertCategory(input: CategoryInput, actor: AuditActor, existingSlug?: string) {
  const db = await getDb();
  await db
    .transaction(async (tx) => {
      const parentId = input.parentSlug
        ? (await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.parentSlug)))[0]?.id ?? null
        : null;
      const values = { slug: input.slug, position: input.position ?? 0, image: input.image ?? null, isActive: input.isActive ?? true, parentId };
      let id: string;
      if (existingSlug) {
        const [row] = await tx.update(categories).set(values).where(eq(categories.slug, existingSlug)).returning({ id: categories.id });
        if (!row) throw new AppError("NOT_FOUND", "Category not found");
        id = row.id;
      } else {
        [{ id }] = await tx.insert(categories).values(values).returning({ id: categories.id });
      }
      for (const [locale, t] of Object.entries(input.translations) as [Locale, { name: string; short: string; tagline?: string } | undefined][]) {
        if (!t) continue;
        const v = { name: t.name, short: t.short, tagline: t.tagline ?? "" };
        await tx
          .insert(categoryTranslations)
          .values({ categoryId: id, locale, ...v })
          .onConflictDoUpdate({ target: [categoryTranslations.categoryId, categoryTranslations.locale], set: v });
      }
      await audit(tx, actor, existingSlug ? "category.update" : "category.create", { type: "category", id }, { after: input });
    })
    .catch(mapUnique);
}
