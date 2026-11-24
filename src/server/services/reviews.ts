import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "../db/client";
import { orderItems, orders, products, reviews, users } from "../db/schema";
import { AppError } from "../lib/errors";
import { audit, type AuditActor } from "./audit";
import type { ReviewListDTO } from "@/lib/api-types";

/** Recompute the denormalized rating on the product from published reviews. */
export async function refreshRating(d: DbOrTx, productId: string) {
  await d.execute(sql`
    update products p set
      rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from reviews r where r.product_id = p.id and r.status = 'published'), 0),
      rating_count = (select count(*) from reviews r where r.product_id = p.id and r.status = 'published')
    where p.id = ${productId}`);
}

async function productIdBySlug(d: DbOrTx, slug: string) {
  const [p] = await d.select({ id: products.id }).from(products).where(and(eq(products.slug, slug), eq(products.status, "active")));
  if (!p) throw new AppError("NOT_FOUND", "Product not found");
  return p.id;
}

/** The delivered order that entitles a user to review a product (verified purchase), if any. */
async function deliveredOrderFor(d: DbOrTx, userId: string, productId: string) {
  const [row] = await d
    .select({ orderId: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.userId, userId), eq(orders.status, "delivered"), eq(orderItems.productId, productId)))
    .limit(1);
  return row?.orderId ?? null;
}

/** Privacy: show "Amina B." rather than a full name. */
const displayName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first || "Client";
};

export async function listReviews(slug: string, viewerId: string | null, page = 1, pageSize = 10): Promise<ReviewListDTO> {
  const db = await getDb();
  const [p] = await db
    .select({ id: products.id, ratingAvg: products.ratingAvg, ratingCount: products.ratingCount })
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.status, "active")));
  if (!p) throw new AppError("NOT_FOUND", "Product not found");
  const where = and(eq(reviews.productId, p.id), eq(reviews.status, "published"));
  const rows = await db
    .select({ id: reviews.id, rating: reviews.rating, title: reviews.title, body: reviews.body, createdAt: reviews.createdAt, userId: reviews.userId, name: users.name })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(where)
    .orderBy(desc(reviews.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  let canReview = false;
  if (viewerId) {
    const [mine] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.productId, p.id), eq(reviews.userId, viewerId)));
    canReview = !mine && Boolean(await deliveredOrderFor(db, viewerId, p.id));
  }
  return {
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: displayName(r.name),
      createdAt: r.createdAt.toISOString(),
      mine: r.userId === viewerId,
    })),
    total: p.ratingCount,
    rating: Number(p.ratingAvg),
    count: p.ratingCount,
    canReview,
  };
}

export async function createReview(userId: string, slug: string, input: { rating: number; title?: string | null; body: string }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const productId = await productIdBySlug(tx, slug);
    const orderId = await deliveredOrderFor(tx, userId, productId);
    if (!orderId) throw new AppError("REVIEW_NOT_ALLOWED", "Only customers who received this product can review it");
    const [created] = await tx
      .insert(reviews)
      .values({ productId, userId, orderId, rating: input.rating, title: input.title?.trim() || null, body: input.body.trim() })
      .onConflictDoNothing()
      .returning({ id: reviews.id });
    if (!created) throw new AppError("CONFLICT", "You already reviewed this product");
    await refreshRating(tx, productId);
  });
}

export async function deleteOwnReview(userId: string, reviewId: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [r] = await tx.delete(reviews).where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId))).returning();
    if (!r) throw new AppError("NOT_FOUND", "Review not found");
    await refreshRating(tx, r.productId);
  });
}

export async function moderateReview(reviewId: string, status: "published" | "hidden", actor: AuditActor) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(reviews).where(eq(reviews.id, reviewId)).for("update");
    if (!before) throw new AppError("NOT_FOUND", "Review not found");
    await tx.update(reviews).set({ status }).where(eq(reviews.id, reviewId));
    await refreshRating(tx, before.productId);
    await audit(tx, actor, "review.moderate", { type: "review", id: reviewId }, { before: { status: before.status }, after: { status } });
  });
}
