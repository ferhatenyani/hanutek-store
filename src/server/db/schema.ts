import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Money is stored as integer DZD (whole dinars, the currency's practical unit).
 * Every table has created_at; mutable tables have updated_at.
 * Localized content lives in *_translations tables keyed by (entity, locale).
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const roleEnum = pgEnum("user_role", ["customer", "staff", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);
export const localeEnum = pgEnum("locale", ["fr", "ar"]);
export const tokenTypeEnum = pgEnum("token_type", ["email_verify", "password_reset"]);
export const productStatusEnum = pgEnum("product_status", ["draft", "active", "archived"]);
export const promoTypeEnum = pgEnum("promo_type", ["percent", "fixed"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod"]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "paid", "refunded"]);
export const reviewStatusEnum = pgEnum("review_status", ["published", "hidden"]);
export const stockReasonEnum = pgEnum("stock_reason", ["order", "cancel", "return", "adjustment", "restock"]);

// ---------------------------------------------------------------- identity

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always stored lower-cased and trimmed. */
    email: text("email").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    passwordHash: text("password_hash"),
    googleSub: text("google_sub"),
    name: text("name").notNull(),
    phone: text("phone"),
    locale: localeEnum("locale").notNull().default("fr"),
    role: roleEnum("role").notNull().default("customer"),
    status: userStatusEnum("status").notNull().default("active"),
    /** Bumped to invalidate every outstanding access token (password change, disable, role change). */
    tokenVersion: integer("token_version").notNull().default(0),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_google_sub_uq").on(t.googleSub),
    index("users_role_idx").on(t.role),
    index("users_created_idx").on(t.createdAt),
  ],
);

export const refreshSessions = pgTable(
  "refresh_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** sha256 of the opaque refresh token; the raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    /** All rotations of one login share a family; reuse of a rotated token revokes the family. */
    familyId: uuid("family_id").notNull(),
    expiresAt: ts("expires_at").notNull(),
    rotatedAt: ts("rotated_at"),
    revokedAt: ts("revoked_at"),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("refresh_token_hash_uq").on(t.tokenHash),
    index("refresh_user_idx").on(t.userId),
    index("refresh_family_idx").on(t.familyId),
  ],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: tokenTypeEnum("type").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("verif_token_hash_uq").on(t.tokenHash), index("verif_user_type_idx").on(t.userId, t.type)],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    line1: text("line1").notNull(),
    commune: text("commune").notNull(),
    wilaya: text("wilaya").notNull(),
    postalCode: text("postal_code"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("addresses_user_idx").on(t.userId),
    // at most one default address per user
    uniqueIndex("addresses_one_default_uq").on(t.userId).where(sql`${t.isDefault}`),
  ],
);

// ---------------------------------------------------------------- catalogue

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id"),
    position: integer("position").notNull().default(0),
    image: text("image"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug), index("categories_parent_idx").on(t.parentId)],
);

export const categoryTranslations = pgTable(
  "category_translations",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    name: text("name").notNull(),
    short: text("short").notNull(),
    tagline: text("tagline").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.locale] })],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    /** Brand-style product name, identical across locales (shown dir=ltr in the UI). */
    name: text("name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    status: productStatusEnum("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isBestSeller: boolean("is_best_seller").notNull().default(false),
    isNew: boolean("is_new").notNull().default(false),
    position: integer("position").notNull().default(0),
    /** Denormalized from published reviews; maintained transactionally. */
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2, mode: "number" }).notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    /** Lowest active variant price — denormalized for sorting/filtering. */
    minPrice: integer("min_price").notNull().default(0),
    onSale: boolean("on_sale").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_category_status_idx").on(t.categoryId, t.status),
    index("products_status_price_idx").on(t.status, t.minPrice),
    index("products_status_created_idx").on(t.status, t.createdAt),
  ],
);

export const productTranslations = pgTable(
  "product_translations",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    short: text("short").notNull(),
    description: text("description").notNull(),
    variantTitle: text("variant_title").notNull().default(""),
    specs: jsonb("specs").$type<[string, string][]>().notNull().default([]),
    inTheBox: jsonb("in_the_box").$type<string[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.productId, t.locale] })],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Stable per-product option code, e.g. "dual" — used in URLs/analytics. */
    code: text("code").notNull(),
    sku: text("sku").notNull(),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    stock: integer("stock").notNull().default(0),
    /** Free-form attributes for the admin (e.g. {"size":"M","color":"tan"}). */
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("variants_product_code_uq").on(t.productId, t.code),
    uniqueIndex("variants_sku_uq").on(t.sku),
    index("variants_product_idx").on(t.productId),
    check("variants_stock_nonneg", sql`${t.stock} >= 0`),
    check("variants_price_pos", sql`${t.price} >= 0`),
  ],
);

export const variantTranslations = pgTable(
  "variant_translations",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    label: text("label").notNull(),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.locale] })],
);

export type ImageVariants = { thumb: string; md: string; lg: string };

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Canonical display URL (largest optimized variant, or a static asset). */
    url: text("url").notNull(),
    variants: jsonb("variants").$type<ImageVariants | null>(),
    storageKey: text("storage_key"),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("images_product_idx").on(t.productId, t.position)],
);

// ---------------------------------------------------------------- shopping

export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Upper-cased. */
    code: text("code").notNull(),
    description: text("description"),
    type: promoTypeEnum("type").notNull(),
    /** percent: 1–100; fixed: DZD amount. */
    value: integer("value").notNull(),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    maxDiscount: integer("max_discount"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    usageLimit: integer("usage_limit"),
    perUserLimit: integer("per_user_limit"),
    usedCount: integer("used_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("promotions_code_uq").on(t.code),
    check("promotions_value_pos", sql`${t.value} > 0`),
  ],
);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** sha256 of the guest cart cookie token. */
    guestTokenHash: text("guest_token_hash"),
    promotionId: uuid("promotion_id").references(() => promotions.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("carts_user_uq").on(t.userId),
    uniqueIndex("carts_guest_uq").on(t.guestTokenHash),
    index("carts_updated_idx").on(t.updatedAt),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("cart_items_cart_variant_uq").on(t.cartId, t.variantId),
    check("cart_items_qty_range", sql`${t.qty} between 1 and 10`),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-facing reference, e.g. HT-482913. */
    number: text("number").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** sha256 of the guest access key (guest orders only). */
    guestAccessHash: text("guest_access_hash"),
    /** Client-provided idempotency key: a retried submit returns the same order. */
    idempotencyKey: text("idempotency_key").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cod"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
    currency: text("currency").notNull().default("DZD"),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    /** Set by staff / a future carrier integration — 0 until then. */
    shippingFee: integer("shipping_fee").notNull().default(0),
    total: integer("total").notNull(),
    promotionId: uuid("promotion_id").references(() => promotions.id, { onDelete: "set null" }),
    promotionCode: text("promotion_code"),
    locale: localeEnum("locale").notNull().default("fr"),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email"),
    shipLine1: text("ship_line1").notNull(),
    shipCommune: text("ship_commune").notNull(),
    shipWilaya: text("ship_wilaya").notNull(),
    shipPostalCode: text("ship_postal_code"),
    customerNote: text("customer_note"),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    internalNote: text("internal_note"),
    placedAt: ts("placed_at").notNull().defaultNow(),
    cancelledAt: ts("cancelled_at"),
    deliveredAt: ts("delivered_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.number),
    uniqueIndex("orders_idem_uq").on(t.idempotencyKey),
    index("orders_user_placed_idx").on(t.userId, t.placedAt),
    index("orders_status_placed_idx").on(t.status, t.placedAt),
    index("orders_phone_idx").on(t.contactPhone),
    check("orders_total_nonneg", sql`${t.total} >= 0`),
  ],
);

export type LocalizedText = { fr: string; ar: string };

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    /** Snapshots at purchase time — the catalogue may change later. */
    productSlug: text("product_slug").notNull(),
    productName: text("product_name").notNull(),
    variantLabel: jsonb("variant_label").$type<LocalizedText>().notNull(),
    sku: text("sku").notNull(),
    image: text("image").notNull(),
    unitPrice: integer("unit_price").notNull(),
    qty: integer("qty").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull(),
    note: text("note"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

export const promotionRedemptions = pgTable(
  "promotion_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    phone: text("phone").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("redemptions_order_uq").on(t.orderId),
    index("redemptions_promo_user_idx").on(t.promotionId, t.userId),
    index("redemptions_promo_phone_idx").on(t.promotionId, t.phone),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    rating: smallint("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    status: reviewStatusEnum("status").notNull().default("published"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("reviews_product_user_uq").on(t.productId, t.userId),
    index("reviews_product_status_idx").on(t.productId, t.status, t.createdAt),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    stockAfter: integer("stock_after").notNull(),
    reason: stockReasonEnum("reason").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("inventory_variant_idx").on(t.variantId, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_actor_idx").on(t.actorId, t.createdAt),
    index("audit_created_idx").on(t.createdAt),
  ],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: ts("reset_at").notNull(),
});

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    locale: localeEnum("locale").notNull().default("fr"),
    unsubscribedAt: ts("unsubscribed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("newsletter_email_uq").on(t.email)],
);
