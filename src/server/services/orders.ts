import "server-only";
import { createHmac } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, type DbOrTx, type Tx } from "../db/client";
import {
  cartItems,
  inventoryMovements,
  orderEvents,
  orderItems,
  orders,
  productImages,
  productVariants,
  products,
  promotionRedemptions,
  promotions,
  users,
  variantTranslations,
} from "../db/schema";
import { env } from "../env";
import { orderNumber, safeEqual, sha256 } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { log } from "../lib/logger";
import { audit, type AuditActor } from "./audit";
import { clearCart, findCart, type CartOwner } from "./cart";
import { upsertDefaultAddress } from "./accounts";
import { computeDiscount, ineligibility } from "./promotions";
import { likeEscape } from "./catalog";
import type {
  Locale,
  OrderDTO,
  OrderStage,
  OrderStatus,
  OrderSummaryDTO,
  PlaceOrderResultDTO,
  TrackingStep,
} from "@/lib/api-types";

// ------------------------------------------------------------ status model

/** Allowed staff transitions. Customers may only cancel pending/confirmed orders. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivered", "returned"],
  out_for_delivery: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};
const CUSTOMER_CANCELLABLE: OrderStatus[] = ["pending", "confirmed"];
const RESTOCK_ON: OrderStatus[] = ["cancelled", "returned"];

export function stageOf(status: OrderStatus): OrderStage {
  if (status === "cancelled" || status === "returned") return "cancelled";
  if (status === "delivered") return "delivered";
  if (status === "shipped" || status === "out_for_delivery") return "shipped";
  return "processing";
}

const STEP_STATUS: Record<TrackingStep, OrderStatus> = {
  placed: "pending",
  packed: "packed",
  shipped: "shipped",
  out: "out_for_delivery",
  delivered: "delivered",
};
const STEPS: TrackingStep[] = ["placed", "packed", "shipped", "out", "delivered"];

/** Customer timeline: a step is done once its status (or any later one) was reached. */
export function buildTimeline(placedAt: Date, events: { status: OrderStatus; createdAt: Date }[]) {
  const at = (s: OrderStatus) => events.find((e) => e.status === s)?.createdAt ?? null;
  const times = STEPS.map((step) => (step === "placed" ? placedAt : at(STEP_STATUS[step])));
  // back-fill skipped steps with the next reached step's time
  for (let i = times.length - 2; i >= 0; i--) if (!times[i] && times[i + 1]) times[i] = times[i + 1];
  return STEPS.map((step, i) => ({ step, at: times[i]?.toISOString() ?? null }));
}

// ------------------------------------------------------------ guest access

/** Guest order access key: HMAC of the order id (recomputable for idempotent replays, never stored raw). */
export const guestAccessKey = (orderId: string) =>
  createHmac("sha256", env().JWT_SECRET).update(`order-access:${orderId}`).digest("base64url");

// ------------------------------------------------------------ DTOs

type OrderRow = typeof orders.$inferSelect;

async function toOrderDTO(d: DbOrTx, o: OrderRow): Promise<OrderDTO> {
  const [items, events] = await Promise.all([
    d.select().from(orderItems).where(eq(orderItems.orderId, o.id)).orderBy(asc(orderItems.productName), asc(orderItems.id)),
    d
      .select({ status: orderEvents.status, createdAt: orderEvents.createdAt })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, o.id))
      .orderBy(asc(orderEvents.createdAt)),
  ]);
  return {
    number: o.number,
    placedAt: o.placedAt.toISOString(),
    status: o.status,
    stage: stageOf(o.status),
    items: items.map((i) => ({
      slug: i.productSlug,
      name: i.productName,
      variant: i.variantLabel,
      image: i.image,
      unitPrice: i.unitPrice,
      qty: i.qty,
      lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    discount: o.discount,
    shippingFee: o.shippingFee,
    total: o.total,
    promoCode: o.promotionCode,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    address: {
      fullName: o.contactName,
      phone: o.contactPhone,
      email: o.contactEmail,
      line1: o.shipLine1,
      commune: o.shipCommune,
      wilaya: o.shipWilaya,
      postalCode: o.shipPostalCode,
    },
    timeline: buildTimeline(o.placedAt, events),
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    cancellable: CUSTOMER_CANCELLABLE.includes(o.status),
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
  };
}

// ------------------------------------------------------------ checkout

export interface PlaceOrderInput {
  idempotencyKey: string;
  contact: { name: string; phone: string; email?: string | null };
  address: { line1: string; commune: string; wilaya: string; postalCode?: string | null };
  note?: string | null;
  locale: Locale;
  saveAddress?: boolean;
}

/** Normalizes Algerian phone input: strips spaces/dots/dashes, maps +213/00213 to 0. */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s.\-()]/g, "");
  if (p.startsWith("+213")) p = "0" + p.slice(4);
  else if (p.startsWith("00213")) p = "0" + p.slice(5);
  return p;
}

async function uniqueOrderNumber(tx: Tx): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const n = orderNumber();
    const [hit] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.number, n));
    if (!hit) return n;
  }
  throw new AppError("INTERNAL", "Could not allocate an order number");
}

export async function placeOrder(owner: CartOwner, input: PlaceOrderInput): Promise<PlaceOrderResultDTO> {
  const db = await getDb();
  const scope = owner.userId ? `u:${owner.userId}` : owner.guestToken ? `g:${sha256(owner.guestToken)}` : null;
  if (!scope) throw new AppError("CART_EMPTY", "Your cart is empty");
  const idemKey = `${scope}:${input.idempotencyKey}`;
  const phone = normalizePhone(input.contact.phone);

  // Idempotent replay: the same submit (network retry / double click) returns the original order.
  const [prior] = await db.select().from(orders).where(eq(orders.idempotencyKey, idemKey));
  if (prior) return { order: await toOrderDTO(db, prior), accessKey: prior.userId ? null : guestAccessKey(prior.id) };

  const result = await db.transaction(async (tx) => {
    // Serialize concurrent submits of the same cart (double click from two tabs).
    const cartRow = await findCart(tx, owner);
    if (cartRow) await tx.execute(sql`select id from carts where id = ${cartRow.id} for update`);
    const cart = cartRow ? await findCart(tx, owner) : undefined;
    if (!cart) throw new AppError("CART_EMPTY", "Your cart is empty");
    const lines = await tx.select().from(cartItems).where(eq(cartItems.cartId, cart.id)).orderBy(asc(cartItems.variantId));
    if (lines.length === 0) throw new AppError("CART_EMPTY", "Your cart is empty");

    // Lock the variant rows (stable order avoids deadlocks between concurrent checkouts).
    const variantIds = lines.map((l) => l.variantId);
    const variants = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        price: productVariants.price,
        stock: productVariants.stock,
        sku: productVariants.sku,
        code: productVariants.code,
        active: productVariants.isActive,
        status: products.status,
        slug: products.slug,
        name: products.name,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, variantIds))
      .orderBy(asc(productVariants.id))
      .for("update", { of: productVariants });

    const problems: { variantId: string; available: number }[] = [];
    for (const l of lines) {
      const v = variants.find((x) => x.id === l.variantId);
      if (!v || !v.active || v.status !== "active" || v.stock < l.qty) {
        problems.push({ variantId: l.variantId, available: v && v.active && v.status === "active" ? v.stock : 0 });
      }
    }
    if (problems.length) throw new AppError("OUT_OF_STOCK", "Some items are no longer available in the requested quantity", { lines: problems });

    const subtotal = lines.reduce((s, l) => s + variants.find((v) => v.id === l.variantId)!.price * l.qty, 0);

    // Promotion: re-validated at checkout with the phone number (per-customer limits for guests).
    let discount = 0;
    let promo: typeof promotions.$inferSelect | undefined;
    if (cart.promotionId) {
      [promo] = await tx.select().from(promotions).where(eq(promotions.id, cart.promotionId)).for("update");
      const reason = await ineligibility(tx, promo, { subtotal, userId: owner.userId, phone });
      if (reason) throw new AppError("PROMO_INVALID", "The promo code on your cart can no longer be applied", { reason });
      discount = computeDiscount(promo!, subtotal);
    }
    const shippingFee = 0; // set later by staff / carrier integration
    const total = Math.max(0, subtotal - discount + shippingFee);

    const [images, labels] = await Promise.all([
      tx.select().from(productImages).where(inArray(productImages.productId, variants.map((v) => v.productId))).orderBy(asc(productImages.position)),
      tx.select().from(variantTranslations).where(inArray(variantTranslations.variantId, variantIds)),
    ]);

    const [order] = await tx
      .insert(orders)
      .values({
        number: await uniqueOrderNumber(tx),
        userId: owner.userId ?? null,
        idempotencyKey: idemKey,
        subtotal,
        discount,
        shippingFee,
        total,
        promotionId: promo?.id ?? null,
        promotionCode: promo?.code ?? null,
        locale: input.locale,
        contactName: input.contact.name.trim(),
        contactPhone: phone,
        contactEmail: input.contact.email?.trim().toLowerCase() || null,
        shipLine1: input.address.line1.trim(),
        shipCommune: input.address.commune.trim(),
        shipWilaya: input.address.wilaya,
        shipPostalCode: input.address.postalCode?.trim() || null,
        customerNote: input.note?.trim() || null,
      })
      .returning();
    if (!owner.userId) await tx.update(orders).set({ guestAccessHash: sha256(guestAccessKey(order.id)) }).where(eq(orders.id, order.id));

    await tx.insert(orderItems).values(
      lines.map((l) => {
        const v = variants.find((x) => x.id === l.variantId)!;
        const vl = labels.filter((x) => x.variantId === v.id);
        const fr = vl.find((x) => x.locale === "fr")?.label ?? v.code;
        return {
          orderId: order.id,
          productId: v.productId,
          variantId: v.id,
          productSlug: v.slug,
          productName: v.name,
          variantLabel: { fr, ar: vl.find((x) => x.locale === "ar")?.label ?? fr },
          sku: v.sku,
          image: images.find((i) => i.productId === v.productId)?.url ?? "/products/p1.jpg",
          unitPrice: v.price,
          qty: l.qty,
          lineTotal: v.price * l.qty,
        };
      }),
    );

    // Decrement stock; the WHERE guard makes overselling impossible even without the row lock.
    for (const l of lines) {
      const [after] = await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${l.qty}` })
        .where(and(eq(productVariants.id, l.variantId), gte(productVariants.stock, l.qty)))
        .returning({ stock: productVariants.stock });
      if (!after) throw new AppError("OUT_OF_STOCK", "Some items are no longer available in the requested quantity");
      await tx.insert(inventoryMovements).values({ variantId: l.variantId, delta: -l.qty, stockAfter: after.stock, reason: "order", orderId: order.id });
    }

    if (promo) {
      const [bumped] = await tx
        .update(promotions)
        .set({ usedCount: sql`${promotions.usedCount} + 1` })
        .where(and(eq(promotions.id, promo.id), or(sql`${promotions.usageLimit} is null`, sql`${promotions.usedCount} < ${promotions.usageLimit}`)))
        .returning({ id: promotions.id });
      if (!bumped) throw new AppError("PROMO_INVALID", "This promo code has reached its usage limit", { reason: "exhausted" });
      await tx.insert(promotionRedemptions).values({ promotionId: promo.id, orderId: order.id, userId: owner.userId ?? null, phone });
    }

    await tx.insert(orderEvents).values({ orderId: order.id, status: "pending" });
    await clearCart(tx, cart.id);

    if (owner.userId && input.saveAddress) {
      await upsertDefaultAddress(tx, owner.userId, {
        fullName: input.contact.name,
        phone,
        line1: input.address.line1,
        commune: input.address.commune,
        wilaya: input.address.wilaya,
        postalCode: input.address.postalCode ?? null,
      });
      const [u] = await tx.select({ phone: users.phone }).from(users).where(eq(users.id, owner.userId));
      if (u && !u.phone) await tx.update(users).set({ phone }).where(eq(users.id, owner.userId));
    }
    return order;
  }).catch(async (err) => {
    // A concurrent identical submit may have won: return its order instead of an error.
    const [winner] = await db.select().from(orders).where(eq(orders.idempotencyKey, idemKey));
    if (winner) return winner;
    throw err;
  });

  log.info("order_placed", { orderNumber: result.number, userId: owner.userId, total: result.total });
  return { order: await toOrderDTO(db, result), accessKey: result.userId ? null : guestAccessKey(result.id) };
}

// ------------------------------------------------------------ reads

export interface Viewer {
  userId?: string | null;
  guestKey?: string | null;
  /** staff with orders:read */
  staff?: boolean;
}

/**
 * Loads an order the viewer is entitled to see. Anything else is reported as
 * NOT_FOUND (never FORBIDDEN) so order numbers cannot be enumerated.
 */
export async function getOrderForViewer(number: string, viewer: Viewer): Promise<OrderDTO> {
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.number, number.toUpperCase()));
  if (!o || !canView(o, viewer)) throw new AppError("NOT_FOUND", "Order not found");
  return toOrderDTO(db, o);
}

function canView(o: OrderRow, viewer: Viewer): boolean {
  if (viewer.staff) return true;
  if (o.userId) return Boolean(viewer.userId) && viewer.userId === o.userId;
  return Boolean(viewer.guestKey) && safeEqual(guestAccessKey(o.id), viewer.guestKey!);
}

export async function listUserOrders(userId: string, page = 1, pageSize = 20): Promise<{ items: OrderSummaryDTO[]; total: number }> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.placedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(orders).where(eq(orders.userId, userId));
  return { items: await summaries(db, rows), total };
}

async function summaries(d: DbOrTx, rows: OrderRow[]): Promise<OrderSummaryDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [counts, events] = await Promise.all([
    d
      .select({ orderId: orderItems.orderId, n: sql<number>`sum(${orderItems.qty})::int` })
      .from(orderItems)
      .where(inArray(orderItems.orderId, ids))
      .groupBy(orderItems.orderId),
    d
      .select({ orderId: orderEvents.orderId, status: orderEvents.status, createdAt: orderEvents.createdAt })
      .from(orderEvents)
      .where(inArray(orderEvents.orderId, ids))
      .orderBy(asc(orderEvents.createdAt)),
  ]);
  return rows.map((o) => ({
    number: o.number,
    placedAt: o.placedAt.toISOString(),
    status: o.status,
    stage: stageOf(o.status),
    itemCount: counts.find((c) => c.orderId === o.id)?.n ?? 0,
    total: o.total,
    timeline: buildTimeline(o.placedAt, events.filter((e) => e.orderId === o.id)),
  }));
}

// ------------------------------------------------------------ status changes

async function restock(tx: Tx, orderId: string, reason: "cancel" | "return", actorId?: string) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.variantId));
  for (const it of items) {
    if (!it.variantId) continue;
    const [after] = await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${it.qty}` })
      .where(eq(productVariants.id, it.variantId))
      .returning({ stock: productVariants.stock });
    if (after) {
      await tx.insert(inventoryMovements).values({ variantId: it.variantId, delta: it.qty, stockAfter: after.stock, reason, orderId, actorId });
    }
  }
}

async function releasePromo(tx: Tx, orderId: string) {
  const [r] = await tx.delete(promotionRedemptions).where(eq(promotionRedemptions.orderId, orderId)).returning();
  if (r) {
    await tx
      .update(promotions)
      .set({ usedCount: sql`greatest(${promotions.usedCount} - 1, 0)` })
      .where(eq(promotions.id, r.promotionId));
  }
}

async function applyTransition(
  tx: Tx,
  o: OrderRow,
  to: OrderStatus,
  opts: { actorId?: string; note?: string | null },
): Promise<OrderRow> {
  if (!TRANSITIONS[o.status].includes(to)) {
    throw new AppError("INVALID_TRANSITION", `Cannot move an order from ${o.status} to ${to}`);
  }
  const patch: Partial<typeof orders.$inferInsert> = { status: to };
  if (to === "cancelled") patch.cancelledAt = new Date();
  if (to === "delivered") {
    patch.deliveredAt = new Date();
    patch.paymentStatus = "paid"; // cash collected on delivery
  }
  if (to === "returned" && o.paymentStatus === "paid") patch.paymentStatus = "refunded";
  const [updated] = await tx.update(orders).set(patch).where(eq(orders.id, o.id)).returning();
  if (RESTOCK_ON.includes(to)) {
    await restock(tx, o.id, to === "cancelled" ? "cancel" : "return", opts.actorId);
    if (to === "cancelled") await releasePromo(tx, o.id);
  }
  await tx.insert(orderEvents).values({ orderId: o.id, status: to, note: opts.note ?? null, actorId: opts.actorId ?? null });
  return updated;
}

/** Customer cancellation (own order, or guest with access key) while not yet packed. */
export async function cancelByCustomer(number: string, viewer: Viewer): Promise<OrderDTO> {
  const db = await getDb();
  const updated = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.number, number.toUpperCase())).for("update");
    if (!o || !canView(o, { ...viewer, staff: false })) throw new AppError("NOT_FOUND", "Order not found");
    if (!CUSTOMER_CANCELLABLE.includes(o.status)) throw new AppError("ORDER_NOT_CANCELLABLE", "This order can no longer be cancelled");
    return applyTransition(tx, o, "cancelled", { actorId: viewer.userId ?? undefined, note: "Cancelled by customer" });
  });
  return toOrderDTO(db, updated);
}

/** Staff status change with audit trail. */
export async function changeStatusByStaff(
  number: string,
  to: OrderStatus,
  actor: AuditActor,
  extra: { note?: string | null; carrier?: string | null; trackingNumber?: string | null; shippingFee?: number } = {},
): Promise<OrderDTO> {
  const db = await getDb();
  const updated = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.number, number.toUpperCase())).for("update");
    if (!o) throw new AppError("NOT_FOUND", "Order not found");
    let row = await applyTransition(tx, o, to, { actorId: actor.id, note: extra.note });
    const patch: Partial<typeof orders.$inferInsert> = {};
    if (extra.carrier !== undefined) patch.carrier = extra.carrier;
    if (extra.trackingNumber !== undefined) patch.trackingNumber = extra.trackingNumber;
    if (Object.keys(patch).length) [row] = await tx.update(orders).set(patch).where(eq(orders.id, o.id)).returning();
    await audit(tx, actor, "order.status", { type: "order", id: o.number }, { before: { status: o.status }, after: { status: to, ...patch } });
    return row;
  });
  return toOrderDTO(db, updated);
}

/** Staff edits that are not status changes (fee, carrier, notes). */
export async function updateOrderByStaff(
  number: string,
  actor: AuditActor,
  patch: { shippingFee?: number; carrier?: string | null; trackingNumber?: string | null; internalNote?: string | null },
): Promise<OrderDTO> {
  const db = await getDb();
  const updated = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.number, number.toUpperCase())).for("update");
    if (!o) throw new AppError("NOT_FOUND", "Order not found");
    const set: Partial<typeof orders.$inferInsert> = {};
    if (patch.carrier !== undefined) set.carrier = patch.carrier;
    if (patch.trackingNumber !== undefined) set.trackingNumber = patch.trackingNumber;
    if (patch.internalNote !== undefined) set.internalNote = patch.internalNote;
    if (patch.shippingFee !== undefined) {
      if (["delivered", "cancelled", "returned"].includes(o.status)) throw new AppError("CONFLICT", "Order is closed");
      set.shippingFee = patch.shippingFee;
      set.total = Math.max(0, o.subtotal - o.discount + patch.shippingFee);
    }
    const [row] = await tx.update(orders).set(set).where(eq(orders.id, o.id)).returning();
    const before = Object.fromEntries(Object.keys(set).map((k) => [k, o[k as keyof OrderRow]]));
    await audit(tx, actor, "order.update", { type: "order", id: o.number }, { before, after: set });
    return row;
  });
  return toOrderDTO(db, updated);
}

// ------------------------------------------------------------ admin listing

export interface AdminOrderQuery {
  /** One status or several (comma separated in the query string). */
  status?: OrderStatus | OrderStatus[];
  paymentStatus?: "unpaid" | "paid" | "refunded";
  wilaya?: string;
  carrier?: string;
  userId?: string;
  q?: string;
  from?: Date;
  to?: Date;
  sort?: "placed" | "total" | "updated";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

function orderWhere(query: AdminOrderQuery) {
  const conds: SQL[] = [];
  const statuses = query.status === undefined ? [] : Array.isArray(query.status) ? query.status : [query.status];
  if (statuses.length === 1) conds.push(eq(orders.status, statuses[0]));
  if (statuses.length > 1) conds.push(inArray(orders.status, statuses));
  if (query.paymentStatus) conds.push(eq(orders.paymentStatus, query.paymentStatus));
  if (query.wilaya) conds.push(eq(orders.shipWilaya, query.wilaya));
  if (query.carrier) conds.push(ilike(orders.carrier, likeEscape(query.carrier)));
  if (query.userId) conds.push(eq(orders.userId, query.userId));
  if (query.from) conds.push(gte(orders.placedAt, query.from));
  if (query.to) conds.push(lte(orders.placedAt, query.to));
  if (query.q) {
    const p = `%${likeEscape(query.q.trim())}%`;
    conds.push(
      or(
        ilike(orders.number, p),
        ilike(orders.contactPhone, p),
        ilike(orders.contactEmail, p),
        ilike(orders.contactName, p),
        ilike(orders.trackingNumber, p),
      )!,
    );
  }
  return conds.length ? and(...conds) : undefined;
}

export async function adminListOrders(query: AdminOrderQuery) {
  const db = await getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const where = orderWhere(query);
  const col = { placed: orders.placedAt, total: orders.total, updated: orders.updatedAt }[query.sort ?? "placed"];
  const order = (query.dir ?? "desc") === "asc" ? asc(col) : desc(col);
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(orders).where(where).orderBy(order, desc(orders.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);
  const sums = await summaries(db, rows);
  return {
    items: rows.map((o, i) => ({
      ...sums[i],
      customer: { userId: o.userId, name: o.contactName, phone: o.contactPhone, email: o.contactEmail },
      wilaya: o.shipWilaya,
      commune: o.shipCommune,
      paymentStatus: o.paymentStatus,
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
      discount: o.discount,
      promoCode: o.promotionCode,
      updatedAt: o.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralize spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV of the orders matching a filter (capped at 5 000 rows). */
export async function exportOrdersCsv(query: AdminOrderQuery): Promise<string> {
  const db = await getDb();
  const rows = await db.select().from(orders).where(orderWhere(query)).orderBy(desc(orders.placedAt)).limit(5000);
  const header = ["number", "placed_at", "status", "payment_status", "customer", "phone", "email", "wilaya", "commune", "subtotal", "discount", "shipping_fee", "total", "promo_code", "carrier", "tracking_number"];
  const lines = rows.map((o) =>
    [o.number, o.placedAt.toISOString(), o.status, o.paymentStatus, o.contactName, o.contactPhone, o.contactEmail, o.shipWilaya, o.shipCommune, o.subtotal, o.discount, o.shippingFee, o.total, o.promotionCode, o.carrier, o.trackingNumber]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

/**
 * Applies the same status change to many orders. Each order is its own
 * transaction (so one invalid transition does not block the others) and the
 * result reports what happened per order.
 */
export async function bulkChangeStatus(
  numbers: string[],
  to: OrderStatus,
  actor: AuditActor,
  extra: { note?: string | null; carrier?: string | null } = {},
) {
  const results: { number: string; ok: boolean; code?: string; message?: string }[] = [];
  for (const number of [...new Set(numbers.map((n) => n.toUpperCase()))]) {
    try {
      await changeStatusByStaff(number, to, actor, extra);
      results.push({ number, ok: true });
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      results.push({ number, ok: false, code: err.code, message: err.message });
    }
  }
  return { results, updated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
}

export async function adminGetOrder(number: string) {
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.number, number.toUpperCase()));
  if (!o) throw new AppError("NOT_FOUND", "Order not found");
  const [dto, events, lines, account] = await Promise.all([
    toOrderDTO(db, o),
    db
      .select({ status: orderEvents.status, note: orderEvents.note, actorId: orderEvents.actorId, createdAt: orderEvents.createdAt, actorName: users.name, actorRole: users.role })
      .from(orderEvents)
      .leftJoin(users, eq(users.id, orderEvents.actorId))
      .where(eq(orderEvents.orderId, o.id))
      .orderBy(asc(orderEvents.createdAt)),
    db
      .select({ id: orderItems.id, productId: orderItems.productId, variantId: orderItems.variantId, sku: orderItems.sku, productSlug: orderItems.productSlug })
      .from(orderItems)
      .where(eq(orderItems.orderId, o.id))
      .orderBy(asc(orderItems.productName), asc(orderItems.id)),
    o.userId
      ? db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            createdAt: users.createdAt,
            orderCount: sql<number>`(select count(*)::int from orders x where x.user_id = "users"."id")`,
          })
          .from(users)
          .where(eq(users.id, o.userId))
      : Promise.resolve([]),
  ]);
  return {
    ...dto,
    items: dto.items.map((it, i) => ({ ...it, ...lines[i] })),
    userId: o.userId,
    account: account[0] ? { ...account[0], createdAt: account[0].createdAt.toISOString() } : null,
    internalNote: o.internalNote,
    customerNote: o.customerNote,
    locale: o.locale,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    updatedAt: o.updatedAt.toISOString(),
    events: events.map((e) => ({
      status: e.status,
      note: e.note,
      actorId: e.actorId,
      actorName: e.actorName,
      actorRole: e.actorRole,
      at: e.createdAt.toISOString(),
    })),
    allowedTransitions: TRANSITIONS[o.status],
  };
}

