import type { OrderStatus, OrderStage, Localized } from "@/lib/api-types";

/* Response shapes of the /api/v1/admin endpoints (dates arrive as ISO strings). */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Analytics {
  range: { days: number; from: string; to: string };
  kpis: Kpis;
  previous: Kpis;
  series: { day: string; orders: number; gross: number }[];
  topProducts: { productId: string | null; slug: string; name: string; units: number; revenue: number }[];
  regions: { wilaya: string; orders: number; revenue: number }[];
  categories: { slug: string; name: string; revenue: number }[];
  lowStock: { variantId: string; productId: string; name: string; sku: string; label: string | null; stock: number }[];
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  recentOrders: { number: string; status: OrderStatus; total: number; name: string; placedAt: string }[];
  activity: { id: string; action: string; entityType: string; entityId: string | null; createdAt: string; actorName: string | null }[];
  cash: { inTransit: number; inTransitOrders: number; toFulfil: number };
}
export interface Kpis {
  orders: number;
  grossSales: number;
  collected: number;
  avgOrderValue: number;
  cancelRate: number;
  unitsSold: number;
  newCustomers: number;
}

export interface OrderRow {
  number: string;
  placedAt: string;
  status: OrderStatus;
  stage: OrderStage;
  itemCount: number;
  total: number;
  customer: { userId: string | null; name: string; phone: string; email: string | null };
  wilaya: string;
  commune: string;
  paymentStatus: "unpaid" | "paid" | "refunded";
  carrier: string | null;
  trackingNumber: string | null;
  discount: number;
  promoCode: string | null;
  updatedAt: string;
}

export interface OrderDetail {
  number: string;
  placedAt: string;
  status: OrderStatus;
  stage: OrderStage;
  items: { slug: string; name: string; variant: Localized; image: string; unitPrice: number; qty: number; lineTotal: number; id: string; productId: string | null; variantId: string | null; sku: string }[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  promoCode: string | null;
  paymentMethod: "cod";
  paymentStatus: "unpaid" | "paid" | "refunded";
  address: { fullName: string; phone: string; email: string | null; line1: string; commune: string; wilaya: string; postalCode: string | null };
  cancelledAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  userId: string | null;
  account: { id: string; name: string; email: string; createdAt: string; orderCount: number } | null;
  internalNote: string | null;
  customerNote: string | null;
  locale: "fr" | "ar";
  deliveredAt: string | null;
  updatedAt: string;
  events: { status: OrderStatus; note: string | null; actorId: string | null; actorName: string | null; actorRole: string | null; at: string }[];
  allowedTransitions: OrderStatus[];
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "active" | "archived";
  categorySlug: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNew: boolean;
  onSale: boolean;
  minPrice: number;
  ratingAvg: number;
  ratingCount: number;
  totalStock: number;
  variantCount: number;
  lowVariants: number;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVariant {
  id: string;
  code: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  isActive: boolean;
  attributes: Record<string, string>;
  position: number;
  labels: { fr: string; ar: string };
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: "draft" | "active" | "archived";
  featured: boolean;
  bestSeller: boolean;
  isNew: boolean;
  position: number;
  rating: number;
  reviews: number;
  createdAt: string;
  updatedAt: string;
  short: Localized;
  variantTitle: Localized;
  variants: { id: string; label: Localized }[];
  detail?: {
    description: Localized;
    specs: { fr: [string, string][]; ar: [string, string][] };
    inTheBox: { fr: string[]; ar: string[] };
  };
  adminVariants: AdminVariant[];
  adminImages: { id: string; url: string; variants: { thumb: string; md: string; lg: string } | null; alt: string | null; position: number; width: number | null; height: number | null }[];
}

export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: string;
  categorySlug: string;
  sku: string;
  code: string;
  label: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  image: string | null;
  lastMovementAt: string | null;
  sold30: number;
  updatedAt: string;
}
export interface InventoryResponse extends Paged<InventoryRow> {
  summary: { units: number; value: number; out: number; low: number; skus: number; lowThreshold: number };
}

export interface Movement {
  id: string;
  variantId: string;
  delta: number;
  stockAfter: number;
  reason: "order" | "cancel" | "return" | "adjustment" | "restock";
  note: string | null;
  createdAt: string;
  sku: string;
  productId: string;
  productName: string;
  orderNumber: string | null;
  actorName: string | null;
}

export interface CategoryRow {
  id: string;
  slug: string;
  parentId: string | null;
  parentSlug: string | null;
  position: number;
  image: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  activeProductCount: number;
  translations: { fr: CategoryCopy | null; ar: CategoryCopy | null };
}
export interface CategoryCopy {
  name: string;
  short: string;
  tagline: string;
}

export interface CustomerRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "customer" | "staff" | "admin";
  status: "active" | "disabled";
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface CustomerDetail extends Omit<CustomerRow, "orderCount" | "totalSpent" | "lastOrderAt"> {
  locale: "fr" | "ar";
  googleLinked: boolean;
  orders: { number: string; status: OrderStatus; paymentStatus: string; total: number; placedAt: string }[];
  addresses: { id: string; label: string | null; fullName: string; phone: string | null; line1: string; commune: string; wilaya: string; postalCode: string | null; isDefault: boolean }[];
  reviews: { id: string; rating: number; title: string | null; body: string; status: "published" | "hidden"; createdAt: string; productName: string; productId: string }[];
  stats: {
    orderCount: number;
    delivered: number;
    cancelled: number;
    totalSpent: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    avgOrderValue: number;
    favorites: number;
    activeSessions: number;
  };
  activity: { id: string; action: string; createdAt: string; actorName: string | null; after: unknown }[];
}

export interface Promotion {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  revenue: number;
  discountGiven: number;
  orderCount: number;
}
export interface PromotionDetail extends Promotion {
  redemptions: { id: string; createdAt: string; phone: string; orderNumber: string; orderStatus: OrderStatus; total: number; discount: number; customerName: string; userId: string | null }[];
}

export interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: "published" | "hidden";
  createdAt: string;
  updatedAt: string;
  verified: boolean;
  productId: string;
  productName: string;
  productSlug: string;
  userId: string;
  authorName: string;
  authorEmail: string;
}
export interface ReviewsResponse extends Paged<ReviewRow> {
  counts: { all: number; published: number; hidden: number; avg: number };
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
}

export interface Carrier {
  id: string;
  name: string;
  trackingUrl: string | null;
  phone: string | null;
  note: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  inTransit: number;
  delivered: number;
  returned: number;
}

export interface Subscriber {
  id: string;
  email: string;
  locale: "fr" | "ar";
  unsubscribedAt: string | null;
  createdAt: string;
}
