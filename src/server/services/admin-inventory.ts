import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Tx } from "../db/client";
import { categories, inventoryMovements, productVariants, products } from "../db/schema";
import { AppError } from "../lib/errors";
import { audit, type AuditActor } from "./audit";
import { likeEscape } from "./catalog";
import { LOW_STOCK } from "./admin-products";

/*
 * Inventory: every stock change goes through the ledger (inventory_movements)
 * and the audit log, inside the transaction that changes the stock.
 */

export interface StockChange {
  delta?: number;
  set?: number;
  reason: "adjustment" | "restock" | "return";
  note?: string | null;
}

async function adjustStockTx(tx: Tx, variantId: string, input: StockChange, actor: AuditActor) {
  const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for("update");
  if (!v) throw new AppError("NOT_FOUND", "Variant not found");
  const next = input.set !== undefined ? input.set : v.stock + (input.delta ?? 0);
  if (next < 0) throw new AppError("VALIDATION", `Stock cannot go below zero (${v.sku})`, { fields: { delta: "negative_stock" } });
  const delta = next - v.stock;
  if (delta === 0) return { variantId, sku: v.sku, stock: next, changed: false };
  await tx.update(productVariants).set({ stock: next }).where(eq(productVariants.id, variantId));
  await tx.insert(inventoryMovements).values({ variantId, delta, stockAfter: next, reason: input.reason, actorId: actor.id, note: input.note ?? null });
  await audit(tx, actor, "inventory.adjust", { type: "variant", id: variantId }, {
    before: { stock: v.stock },
    after: { stock: next, reason: input.reason, sku: v.sku },
  });
  return { variantId, sku: v.sku, stock: next, changed: true };
}

export async function adjustStock(variantId: string, input: StockChange, actor: AuditActor) {
  const db = await getDb();
  return db.transaction((tx) => adjustStockTx(tx, variantId, input, actor));
}

/** All-or-nothing: if one line would go negative nothing is applied. Rows are locked in a stable order. */
export async function bulkAdjustStock(
  items: { variantId: string; delta?: number; set?: number }[],
  common: { reason: StockChange["reason"]; note?: string | null },
  actor: AuditActor,
) {
  const db = await getDb();
  const sorted = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
  return db.transaction(async (tx) => {
    const results = [];
    for (const it of sorted) results.push(await adjustStockTx(tx, it.variantId, { ...common, delta: it.delta, set: it.set }, actor));
    return { items: results, changed: results.filter((r) => r.changed).length };
  });
}

export interface InventoryQuery {
  search?: string;
  stock?: "in" | "low" | "out";
  category?: string;
  status?: "draft" | "active" | "archived";
  sort?: "stock" | "sku" | "name" | "price" | "updated";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function adminListInventory(q: InventoryQuery) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 50));
  const conds: SQL[] = [];
  if (q.stock === "out") conds.push(sql`${productVariants.stock} = 0`);
  if (q.stock === "low") conds.push(sql`${productVariants.stock} between 1 and ${LOW_STOCK}`);
  if (q.stock === "in") conds.push(sql`${productVariants.stock} > ${LOW_STOCK}`);
  if (q.category) conds.push(eq(categories.slug, q.category));
  if (q.status) conds.push(eq(products.status, q.status));
  if (q.search) {
    const p = `%${likeEscape(q.search)}%`;
    conds.push(or(ilike(products.name, p), ilike(productVariants.sku, p), ilike(productVariants.code, p))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const sortCol = {
    stock: productVariants.stock,
    sku: productVariants.sku,
    name: products.name,
    price: productVariants.price,
    updated: productVariants.updatedAt,
  }[q.sort ?? "stock"];
  const order = (q.dir ?? (q.sort === "updated" ? "desc" : "asc")) === "asc" ? asc(sortCol) : desc(sortCol);

  const [rows, [{ total }], [summary]] = await Promise.all([
    db
      .select({
        variantId: productVariants.id,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        productStatus: products.status,
        categorySlug: categories.slug,
        sku: productVariants.sku,
        code: productVariants.code,
        label: sql<string | null>`(select vt.label from variant_translations vt where vt.variant_id = "product_variants"."id" and vt.locale = 'fr')`,
        price: productVariants.price,
        stock: productVariants.stock,
        isActive: productVariants.isActive,
        image: sql<string | null>`(select coalesce(i.variants->>'thumb', i.url) from product_images i where i.product_id = "products"."id" order by i.position limit 1)`,
        lastMovementAt: sql<string | null>`(select max(m.created_at) from inventory_movements m where m.variant_id = "product_variants"."id")`,
        sold30: sql<number>`coalesce((select -sum(m.delta) from inventory_movements m where m.variant_id = "product_variants"."id" and m.reason = 'order' and m.created_at > now() - interval '30 days'), 0)::int`,
        updatedAt: productVariants.updatedAt,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where)
      .orderBy(order, asc(productVariants.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where),
    db
      .select({
        units: sql<number>`coalesce(sum(${productVariants.stock}), 0)::int`,
        value: sql<string>`coalesce(sum(${productVariants.stock}::bigint * ${productVariants.price}), 0)::text`,
        out: sql<number>`(count(*) filter (where ${productVariants.stock} = 0))::int`,
        low: sql<number>`(count(*) filter (where ${productVariants.stock} between 1 and ${LOW_STOCK}))::int`,
        skus: sql<number>`count(*)::int`,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(productVariants.isActive, true), sql`${products.status} <> 'archived'`)),
  ]);
  return {
    items: rows.map((r) => ({ ...r, lastMovementAt: r.lastMovementAt ? new Date(r.lastMovementAt).toISOString() : null })),
    total,
    page,
    pageSize,
    summary: { ...summary, value: Number(summary.value), lowThreshold: LOW_STOCK },
  };
}

export type MovementReason = "order" | "cancel" | "return" | "adjustment" | "restock";

export async function listMovements(q: { variantId?: string; productId?: string; reason?: MovementReason; page?: number; pageSize?: number }) {
  const db = await getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 50));
  const conds: SQL[] = [];
  if (q.variantId) conds.push(eq(inventoryMovements.variantId, q.variantId));
  if (q.productId) conds.push(eq(productVariants.productId, q.productId));
  if (q.reason) conds.push(eq(inventoryMovements.reason, q.reason));
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: inventoryMovements.id,
        variantId: inventoryMovements.variantId,
        delta: inventoryMovements.delta,
        stockAfter: inventoryMovements.stockAfter,
        reason: inventoryMovements.reason,
        note: inventoryMovements.note,
        createdAt: inventoryMovements.createdAt,
        sku: productVariants.sku,
        productId: products.id,
        productName: products.name,
        orderNumber: sql<string | null>`(select o.number from orders o where o.id = "inventory_movements"."order_id")`,
        actorName: sql<string | null>`(select u.name from users u where u.id = "inventory_movements"."actor_id")`,
      })
      .from(inventoryMovements)
      .innerJoin(productVariants, eq(productVariants.id, inventoryMovements.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(where)
      .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(inventoryMovements)
      .innerJoin(productVariants, eq(productVariants.id, inventoryMovements.variantId))
      .where(where),
  ]);
  return { items: rows, total, page, pageSize };
}
