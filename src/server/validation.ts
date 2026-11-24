import { z } from "zod";
import { SORTS } from "./services/catalog";

/*
 * Request schemas. Every external input is parsed through one of these:
 * strings are trimmed and length-bounded, enums are closed, numbers are
 * integer-ranged, unknown keys are stripped (zod default).
 */

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1, "required").max(max);

export const email = z.string().trim().toLowerCase().max(254).email("invalid_email");
/** 8–128 chars; argon2 handles long input but we bound it against DoS. */
export const password = z.string().min(8, "too_short").max(128, "too_long");
export const locale = z.enum(["fr", "ar"]);
/** Algerian phone: 05/06/07 mobile or 0[2-4]… fixed line, optional +213 prefix. */
export const phone = z
  .string()
  .trim()
  .max(20)
  .transform((s) => s.replace(/[\s.\-()]/g, ""))
  .pipe(z.string().regex(/^(?:\+213|00213|0)[1-9]\d{7,8}$/, "invalid_phone"));
export const wilaya = z.string().regex(/^(0[1-9]|[1-5]\d)$/, "invalid_wilaya").refine((w) => Number(w) >= 1 && Number(w) <= 58, "invalid_wilaya");
export const uuid = z.string().uuid("invalid_id");
export const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid_slug").max(120);
const money = z.number().int().min(0).max(100_000_000);
const page = z.coerce.number().int().min(1).max(10_000).default(1);
const pageSize = (max: number, def: number) => z.coerce.number().int().min(1).max(max).default(def);

// ------------------------------------------------------------ auth

export const registerSchema = z.object({
  name: required(80).min(2, "too_short"),
  email,
  password,
  locale: locale.default("fr"),
  acceptTerms: z.literal(true, { error: "terms_required" }),
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: required(200), password });
export const tokenSchema = z.object({ token: required(200) });
export const changePasswordSchema = z.object({ currentPassword: z.string().max(128).optional(), newPassword: password });
export const refreshBodySchema = z.object({ refreshToken: required(200) });

// ------------------------------------------------------------ profile

export const addressSchema = z.object({
  fullName: required(120),
  phone: phone.nullable().optional().transform((v) => v ?? null),
  line1: required(200),
  commune: required(80),
  wilaya,
  postalCode: z.string().trim().regex(/^\d{5}$/, "invalid_postcode").nullable().optional().or(z.literal("").transform(() => null)).transform((v) => v ?? null),
});

export const profilePatchSchema = z.object({
  name: required(80).min(2, "too_short").optional(),
  phone: phone.nullable().optional().or(z.literal("").transform(() => null)),
  locale: locale.optional(),
  defaultAddress: addressSchema.nullable().optional(),
});

// ------------------------------------------------------------ catalogue

export const productListQuery = z.object({
  category: slug.optional(),
  q: text(100).optional(),
  sale: z.enum(["1", "true"]).optional().transform((v) => Boolean(v)),
  sort: z.enum(SORTS).default("featured"),
  page,
  pageSize: pageSize(48, 24),
});
export const suggestQuery = z.object({ q: text(80).default("") });
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: text(120).nullable().optional(),
  body: required(2000).min(10, "too_short"),
});
export const pageQuery = z.object({ page, pageSize: pageSize(50, 10) });

// ------------------------------------------------------------ cart & checkout

export const addItemSchema = z.object({ variantId: uuid, qty: z.number().int().min(1).max(10).default(1) });
export const setQtySchema = z.object({ qty: z.number().int().min(0).max(10) });
export const promoSchema = z.object({ code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "invalid_code") });
export const favoritesMergeSchema = z.object({ slugs: z.array(slug).max(200) });

export const checkoutSchema = z.object({
  /** Client-generated per-checkout key (uuid) — makes order submission idempotent. */
  idempotencyKey: uuid,
  contact: z.object({
    name: required(120).min(2, "too_short"),
    phone,
    email: email.nullable().optional().or(z.literal("").transform(() => null)),
  }),
  address: z.object({
    line1: required(200),
    commune: required(80),
    wilaya,
    postalCode: z.string().trim().regex(/^\d{5}$/, "invalid_postcode").nullable().optional().or(z.literal("").transform(() => null)),
  }),
  note: text(500).nullable().optional(),
  locale: locale.default("fr"),
  saveAddress: z.boolean().default(false),
});

export const orderKeyQuery = z.object({ key: z.string().max(100).optional() });

// ------------------------------------------------------------ admin

const localizedProductCopy = z.object({
  short: required(300),
  description: required(5000),
  variantTitle: text(60).optional(),
  specs: z.array(z.tuple([required(80), required(200)])).max(30).optional(),
  inTheBox: z.array(required(200)).max(30).optional(),
});

export const variantSchema = z.object({
  id: uuid.optional(),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "invalid_code"),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,63}$/, "invalid_sku"),
  price: money,
  compareAtPrice: money.nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  attributes: z.record(z.string().max(40), z.string().max(120)).optional(),
  position: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  labels: z.object({ fr: required(120), ar: required(120) }),
});

const RESERVED_PRODUCT_SLUGS = new Set(["by-slugs"]);

export const productSchema = z.object({
  slug: slug.refine((s) => !RESERVED_PRODUCT_SLUGS.has(s), "reserved_slug"),
  name: required(120),
  categorySlug: slug,
  status: z.enum(["draft", "active", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isNew: z.boolean().optional(),
  position: z.number().int().min(0).max(100_000).optional(),
  translations: z.object({ fr: localizedProductCopy, ar: localizedProductCopy.optional() }),
  variants: z.array(variantSchema).max(50).optional(),
});
export const productPatchSchema = productSchema.partial().extend({
  /** Optimistic concurrency: the `updatedAt` the editor loaded. A mismatch returns 409. */
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

const sortDir = z.enum(["asc", "desc"]).optional();
const productStatus = z.enum(["draft", "active", "archived"]);
const stockLevel = z.enum(["in", "low", "out"]).optional();

export const adminProductQuery = z.object({
  search: text(100).optional(),
  status: productStatus.optional(),
  category: slug.optional(),
  stock: stockLevel,
  flag: z.enum(["featured", "bestSeller", "new", "sale"]).optional(),
  sort: z.enum(["updated", "created", "name", "price", "stock", "rating"]).optional(),
  dir: sortDir,
  page,
  pageSize: pageSize(100, 25),
});

const idList = z.array(uuid).min(1, "required").max(200);

export const productBulkSchema = z.object({
  ids: idList,
  patch: z
    .object({
      status: productStatus.optional(),
      isFeatured: z.boolean().optional(),
      isBestSeller: z.boolean().optional(),
      isNew: z.boolean().optional(),
      categorySlug: slug.optional(),
    })
    .refine((p) => Object.values(p).some((v) => v !== undefined), { message: "nothing to update" }),
});

export const inventoryQuery = z.object({
  search: text(100).optional(),
  stock: stockLevel,
  category: slug.optional(),
  status: productStatus.optional(),
  sort: z.enum(["stock", "sku", "name", "price", "updated"]).optional(),
  dir: sortDir,
  page,
  pageSize: pageSize(100, 50),
});

export const movementQuery = z.object({
  variantId: uuid.optional(),
  productId: uuid.optional(),
  reason: z.enum(["order", "cancel", "return", "adjustment", "restock"]).optional(),
  page,
  pageSize: pageSize(100, 50),
});

export const stockBulkSchema = z.object({
  items: z
    .array(
      z
        .object({ variantId: uuid, delta: z.number().int().min(-1_000_000).max(1_000_000).optional(), set: z.number().int().min(0).max(1_000_000).optional() })
        .refine((v) => (v.delta === undefined) !== (v.set === undefined), { message: "provide exactly one of delta or set" }),
    )
    .min(1)
    .max(200)
    .refine((items) => new Set(items.map((i) => i.variantId)).size === items.length, { message: "duplicate variant" }),
  reason: z.enum(["adjustment", "restock", "return"]),
  note: text(300).nullable().optional(),
});

export const stockAdjustSchema = z
  .object({
    delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    set: z.number().int().min(0).max(1_000_000).optional(),
    reason: z.enum(["adjustment", "restock", "return"]),
    note: text(300).nullable().optional(),
  })
  .refine((v) => (v.delta === undefined) !== (v.set === undefined), { message: "provide exactly one of delta or set", path: ["delta"] });

export const imageOrderSchema = z.object({ order: z.array(uuid).min(1).max(50) });

const categoryCopy = z.object({ name: required(80), short: required(40), tagline: text(200).optional() });
export const categorySchema = z.object({
  slug,
  position: z.number().int().min(0).max(1000).optional(),
  image: text(500).nullable().optional(),
  isActive: z.boolean().optional(),
  parentSlug: slug.nullable().optional(),
  translations: z.object({ fr: categoryCopy, ar: categoryCopy.optional() }),
});

const orderStatus = z.enum(["pending", "confirmed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"]);
export const adminOrderQuery = z.object({
  /** one status, or several comma separated */
  status: z
    .string()
    .max(200)
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(orderStatus).max(8))
    .optional(),
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
  wilaya: wilaya.optional(),
  carrier: text(60).optional(),
  userId: uuid.optional(),
  q: text(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["placed", "total", "updated"]).optional(),
  dir: sortDir,
  page,
  pageSize: pageSize(100, 25),
});
export const orderBulkStatusSchema = z.object({
  numbers: z.array(z.string().trim().regex(/^[A-Za-z]{2}-\d{4,10}$/, "invalid_number")).min(1).max(100),
  status: orderStatus,
  note: text(500).nullable().optional(),
  carrier: text(60).nullable().optional(),
});
export const statusChangeSchema = z.object({
  status: orderStatus,
  note: text(500).nullable().optional(),
  carrier: text(60).nullable().optional(),
  trackingNumber: text(80).nullable().optional(),
});
export const orderPatchSchema = z.object({
  shippingFee: money.optional(),
  carrier: text(60).nullable().optional(),
  trackingNumber: text(80).nullable().optional(),
  internalNote: text(2000).nullable().optional(),
});

export const adminCustomerQuery = z.object({
  search: text(100).optional(),
  role: z.enum(["customer", "staff", "admin"]).optional(),
  scope: z.enum(["team"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  verified: z.enum(["yes", "no"]).optional(),
  sort: z.enum(["created", "name", "orders", "spent", "lastLogin"]).optional(),
  dir: sortDir,
  page,
  pageSize: pageSize(100, 25),
});
export const customerPatchSchema = z
  .object({ status: z.enum(["active", "disabled"]).optional(), role: z.enum(["customer", "staff", "admin"]).optional() })
  .refine((v) => v.status !== undefined || v.role !== undefined, { message: "nothing to update" });

const date = z.coerce.date();
export const promotionSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "invalid_code"),
  description: text(300).nullable().optional(),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1).max(10_000_000),
  minSubtotal: money.optional(),
  maxDiscount: money.nullable().optional(),
  startsAt: date.nullable().optional(),
  endsAt: date.nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  perUserLimit: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});
export const promotionPatchSchema = promotionSchema.partial();
export const reviewModerationSchema = z.object({ status: z.enum(["published", "hidden"]) });
export const auditQuery = z.object({
  entityType: text(40).optional(),
  entityId: text(100).optional(),
  actorId: uuid.optional(),
  action: text(60).optional(),
  q: text(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page,
  pageSize: pageSize(200, 50),
});

export const analyticsQuery = z.object({
  days: z.coerce.number().int().refine((d) => [7, 30, 90, 365].includes(d), "invalid_range").default(30),
});

export const adminReviewQuery = z.object({
  status: z.enum(["published", "hidden"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  productId: uuid.optional(),
  q: text(100).optional(),
  sort: z.enum(["created", "rating"]).optional(),
  dir: sortDir,
  page,
  pageSize: pageSize(100, 25),
});
export const reviewBulkSchema = z.object({ ids: idList, status: z.enum(["published", "hidden"]) });

export const subscriberQuery = z.object({
  q: text(100).optional(),
  status: z.enum(["subscribed", "unsubscribed"]).optional(),
  page,
  pageSize: pageSize(500, 50),
});

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url("invalid_url")
  .refine((u) => /^https?:\/\//i.test(u), "invalid_url");
export const carrierSchema = z.object({
  name: required(60),
  /** may contain {number} — replaced with the tracking number */
  trackingUrl: httpUrl.nullable().optional().or(z.literal("").transform(() => null)),
  phone: text(30).nullable().optional(),
  note: text(300).nullable().optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).max(1000).optional(),
});
export const carrierPatchSchema = carrierSchema.partial();

export const purgeCartsSchema = z.object({ days: z.number().int().min(7).max(365).default(60), dryRun: z.boolean().default(false) });
