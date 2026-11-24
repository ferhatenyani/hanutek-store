import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { favorites, products } from "../db/schema";
import { AppError } from "../lib/errors";

export async function listFavoriteSlugs(userId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ slug: products.slug })
    .from(favorites)
    .innerJoin(products, eq(products.id, favorites.productId))
    .where(and(eq(favorites.userId, userId), eq(products.status, "active")))
    .orderBy(desc(favorites.createdAt));
  return rows.map((r) => r.slug);
}

export async function setFavorite(userId: string, slug: string, on: boolean): Promise<string[]> {
  const db = await getDb();
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.slug, slug), eq(products.status, "active")));
  if (!p) throw new AppError("NOT_FOUND", "Product not found");
  if (on) await db.insert(favorites).values({ userId, productId: p.id }).onConflictDoNothing();
  else await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.productId, p.id)));
  return listFavoriteSlugs(userId);
}

/** Merge locally-saved guest favorites into the account on sign-in. */
export async function mergeFavorites(userId: string, slugs: string[]): Promise<string[]> {
  const db = await getDb();
  const unique = [...new Set(slugs)].slice(0, 200);
  if (unique.length) {
    const rows = await db.select({ id: products.id }).from(products).where(and(inArray(products.slug, unique), eq(products.status, "active")));
    if (rows.length) await db.insert(favorites).values(rows.map((r) => ({ userId, productId: r.id }))).onConflictDoNothing();
  }
  return listFavoriteSlugs(userId);
}
