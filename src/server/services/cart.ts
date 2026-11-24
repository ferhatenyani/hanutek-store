import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "../db/client";
import {
  cartItems,
  carts,
  productImages,
  productVariants,
  products,
  promotions,
  variantTranslations,
} from "../db/schema";
import { randomToken, sha256 } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { MAX_LINE_QTY } from "./catalog";
import { computeDiscount, ineligibility, assertEligible } from "./promotions";
import type { CartDTO, CartLineDTO, Localized } from "@/lib/api-types";

/** Who owns the cart: a signed-in user, or a guest identified by an opaque cookie token. */
export interface CartOwner {
  userId?: string | null;
  guestToken?: string | null;
}

const MAX_LINES = 50;
const EMPTY: CartDTO = { lines: [], count: 0, promo: null, subtotal: 0, discount: 0, total: 0 };

export async function findCart(d: DbOrTx, owner: CartOwner) {
  if (owner.userId) {
    const [c] = await d.select().from(carts).where(eq(carts.userId, owner.userId));
    return c;
  }
  if (owner.guestToken) {
    const [c] = await d.select().from(carts).where(eq(carts.guestTokenHash, sha256(owner.guestToken)));
    return c;
  }
  return undefined;
}

/** Returns the cart, creating it when needed; `newGuestToken` is set when a guest cart was just created. */
async function ensureCart(d: DbOrTx, owner: CartOwner): Promise<{ cart: typeof carts.$inferSelect; newGuestToken?: string }> {
  const existing = await findCart(d, owner);
  if (existing) return { cart: existing };
  if (owner.userId) {
    await d.insert(carts).values({ userId: owner.userId }).onConflictDoNothing();
    const c = await findCart(d, owner);
    return { cart: c! };
  }
  const token = randomToken(32);
  const [cart] = await d.insert(carts).values({ guestTokenHash: sha256(token) }).returning();
  return { cart, newGuestToken: token };
}

/** Builds the priced cart view from current catalogue data (prices are never trusted from the client). */
export async function buildCartDTO(d: DbOrTx, cartId: string | undefined): Promise<CartDTO> {
  if (!cartId) return EMPTY;
  const [cart] = await d.select().from(carts).where(eq(carts.id, cartId));
  if (!cart) return EMPTY;
  const rows = await d
    .select({
      id: cartItems.id,
      qty: cartItems.qty,
      variantId: productVariants.id,
      price: productVariants.price,
      stock: productVariants.stock,
      variantActive: productVariants.isActive,
      code: productVariants.code,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      status: products.status,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.createdAt));

  const variantIds = rows.map((r) => r.variantId);
  const productIds = [...new Set(rows.map((r) => r.productId))];
  const [labels, images] = await Promise.all([
    variantIds.length ? d.select().from(variantTranslations).where(inArray(variantTranslations.variantId, variantIds)) : [],
    productIds.length
      ? d.select().from(productImages).where(inArray(productImages.productId, productIds)).orderBy(asc(productImages.position))
      : [],
  ]);

  const lines: CartLineDTO[] = rows.map((r) => {
    const l = labels.filter((x) => x.variantId === r.variantId);
    const fr = l.find((x) => x.locale === "fr")?.label ?? r.code;
    const label: Localized = { fr, ar: l.find((x) => x.locale === "ar")?.label ?? fr };
    const sellable = r.status === "active" && r.variantActive;
    const maxQty = sellable ? Math.min(MAX_LINE_QTY, r.stock) : 0;
    return {
      id: r.id,
      variantId: r.variantId,
      productId: r.productId,
      slug: r.slug,
      name: r.name,
      image: images.find((i) => i.productId === r.productId)?.url ?? "/products/p1.jpg",
      variantLabel: label,
      unitPrice: r.price,
      qty: r.qty,
      lineTotal: r.price * r.qty,
      available: sellable && r.stock >= r.qty,
      maxQty,
    };
  });

  const subtotal = lines.filter((l) => l.available).reduce((s, l) => s + l.lineTotal, 0);
  let promo: CartDTO["promo"] = null;
  let discount = 0;
  if (cart.promotionId) {
    const [p] = await d.select().from(promotions).where(eq(promotions.id, cart.promotionId));
    if (p) {
      promo = { code: p.code, type: p.type, value: p.value };
      // Only discount while still eligible (e.g. min subtotal); checkout re-validates.
      if (!(await ineligibility(d, p, { subtotal, userId: cart.userId }))) discount = computeDiscount(p, subtotal);
    }
  }
  return {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    promo,
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
  };
}

export async function getCart(owner: CartOwner): Promise<CartDTO> {
  const db = await getDb();
  const cart = await findCart(db, owner);
  return buildCartDTO(db, cart?.id);
}

async function sellableVariant(d: DbOrTx, variantId: string) {
  const [v] = await d
    .select({ id: productVariants.id, stock: productVariants.stock, active: productVariants.isActive, status: products.status })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, variantId));
  if (!v || !v.active || v.status !== "active") throw new AppError("NOT_FOUND", "Product option not found");
  return v;
}

type Mutation = { cart: CartDTO; newGuestToken?: string };

/** Adds qty of a variant (merging with an existing line), capped by stock and the per-line max. */
export async function addItem(owner: CartOwner, variantId: string, qty: number): Promise<Mutation> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const v = await sellableVariant(tx, variantId);
    if (v.stock <= 0) throw new AppError("OUT_OF_STOCK", "This option is out of stock");
    const { cart, newGuestToken } = await ensureCart(tx, owner);
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(cartItems).where(eq(cartItems.cartId, cart.id));
    const [line] = await tx
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
    if (!line && n >= MAX_LINES) throw new AppError("CONFLICT", "Cart is full");
    const cap = Math.min(MAX_LINE_QTY, v.stock);
    const target = Math.min(cap, (line?.qty ?? 0) + qty);
    if (line) await tx.update(cartItems).set({ qty: target }).where(eq(cartItems.id, line.id));
    else await tx.insert(cartItems).values({ cartId: cart.id, variantId, qty: target });
    await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
    return { cart: await buildCartDTO(tx, cart.id), newGuestToken };
  });
}

/** Sets a line's quantity (0 removes it). */
export async function setItemQty(owner: CartOwner, variantId: string, qty: number): Promise<Mutation> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const cart = await findCart(tx, owner);
    if (!cart) return { cart: EMPTY };
    if (qty <= 0) {
      await tx.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
    } else {
      const v = await sellableVariant(tx, variantId);
      const target = Math.max(1, Math.min(qty, MAX_LINE_QTY, Math.max(v.stock, 1)));
      await tx
        .update(cartItems)
        .set({ qty: target })
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
    }
    await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
    return { cart: await buildCartDTO(tx, cart.id) };
  });
}

export async function clearCart(d: DbOrTx, cartId: string) {
  await d.delete(cartItems).where(eq(cartItems.cartId, cartId));
  await d.update(carts).set({ promotionId: null, updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export async function applyPromo(owner: CartOwner, code: string): Promise<Mutation> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { cart, newGuestToken } = await ensureCart(tx, owner);
    const current = await buildCartDTO(tx, cart.id);
    const p = await assertEligible(tx, code, { subtotal: current.subtotal, userId: owner.userId });
    await tx.update(carts).set({ promotionId: p.id }).where(eq(carts.id, cart.id));
    return { cart: await buildCartDTO(tx, cart.id), newGuestToken };
  });
}

export async function removePromo(owner: CartOwner): Promise<Mutation> {
  const db = await getDb();
  const cart = await findCart(db, owner);
  if (!cart) return { cart: EMPTY };
  await db.update(carts).set({ promotionId: null }).where(eq(carts.id, cart.id));
  return { cart: await buildCartDTO(db, cart.id) };
}

/**
 * On sign-in: fold the guest cart into the user's cart (quantities summed,
 * capped by stock), keep the guest promo if the user cart has none, then
 * delete the guest cart.
 */
export async function mergeGuestCart(guestToken: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const guest = await findCart(tx, { guestToken });
    if (!guest) return;
    const guestLines = await tx.select().from(cartItems).where(eq(cartItems.cartId, guest.id));
    const { cart: userCart } = await ensureCart(tx, { userId });
    for (const gl of guestLines) {
      const [v] = await tx.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, gl.variantId));
      if (!v || v.stock <= 0) continue;
      const [existing] = await tx
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, userCart.id), eq(cartItems.variantId, gl.variantId)));
      const qty = Math.min(MAX_LINE_QTY, v.stock, (existing?.qty ?? 0) + gl.qty);
      if (existing) await tx.update(cartItems).set({ qty }).where(eq(cartItems.id, existing.id));
      else await tx.insert(cartItems).values({ cartId: userCart.id, variantId: gl.variantId, qty });
    }
    if (!userCart.promotionId && guest.promotionId) {
      await tx.update(carts).set({ promotionId: guest.promotionId }).where(eq(carts.id, userCart.id));
    }
    await tx.delete(carts).where(eq(carts.id, guest.id));
  });
}

