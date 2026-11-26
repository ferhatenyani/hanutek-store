/**
 * Public API data shapes shared by the server (services, route handlers) and
 * the client. Client-safe: types only, no runtime imports.
 *
 * Localized content ships both locales at once ({ fr, ar }) — the UI switches
 * language client-side instantly without refetching.
 */
export type Locale = "fr" | "ar";
export type Localized = { fr: string; ar: string };

export interface CategoryDTO {
  slug: string;
  name: Localized;
  short: Localized;
  tagline: Localized;
  image: string | null;
}

export interface VariantDTO {
  id: string;
  code: string;
  label: Localized;
  price: number;
  compareAt: number | null;
  /** price − default variant price (for "+X DA" chips) */
  priceDelta: number;
  inStock: boolean;
  /** Units purchasable now (capped at 10 per line); 0 when out of stock. */
  maxQty: number;
}

export interface ProductDetailDTO {
  description: Localized;
  specs: Record<Locale, [string, string][]>;
  inTheBox: Record<Locale, string[]>;
}

export interface ProductDTO {
  id: string;
  slug: string;
  name: string;
  /** category slug */
  category: string;
  /** default (first) variant price */
  price: number;
  compareAt: number | null;
  image: string;
  images: string[];
  short: Localized;
  variantTitle: Localized;
  variants: VariantDTO[];
  rating: number;
  reviews: number;
  bestSeller: boolean;
  isNew: boolean;
  featured: boolean;
  inStock: boolean;
  /** Present on the product detail endpoint only. */
  detail?: ProductDetailDTO;
}

export interface ProductListDTO {
  items: ProductDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export type SuggestionDTO =
  | { kind: "category"; slug: string; label: Localized; sub: Localized }
  | { kind: "product"; slug: string; label: string; sub: Localized; price: number; image: string };

export interface CartLineDTO {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  variantLabel: Localized;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  /** false when the variant is no longer sellable or stock < qty */
  available: boolean;
  maxQty: number;
}

export interface CartPromoDTO {
  code: string;
  type: "percent" | "fixed";
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  /** Why the code currently gives no discount (e.g. "min_subtotal"); null while it applies. */
  ineligible: string | null;
}

export interface CartDTO {
  lines: CartLineDTO[];
  count: number;
  promo: CartPromoDTO | null;
  subtotal: number;
  discount: number;
  total: number;
}

export interface AddressDTO {
  id?: string;
  fullName: string;
  phone: string | null;
  line1: string;
  commune: string;
  wilaya: string;
  postalCode: string | null;
}

export type Role = "customer" | "staff" | "admin";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  role: Role;
  hasPassword: boolean;
  googleLinked: boolean;
  defaultAddress: AddressDTO | null;
}

export interface SessionDTO {
  user: UserDTO | null;
  /** Server capabilities the UI adapts to. */
  features: { google: boolean };
  cart: CartDTO;
  /** product slugs */
  favorites: string[];
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

/** Customer-facing simplification of OrderStatus. */
export type OrderStage = "processing" | "shipped" | "delivered" | "cancelled";
export type TrackingStep = "placed" | "packed" | "shipped" | "out" | "delivered";

export interface OrderItemDTO {
  slug: string;
  name: string;
  variant: Localized;
  image: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface OrderDTO {
  number: string;
  placedAt: string;
  status: OrderStatus;
  stage: OrderStage;
  items: OrderItemDTO[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  promoCode: string | null;
  paymentMethod: "cod";
  paymentStatus: "unpaid" | "paid" | "refunded";
  address: AddressDTO & { email: string | null };
  timeline: { step: TrackingStep; at: string | null }[];
  cancelledAt: string | null;
  cancellable: boolean;
  carrier: string | null;
  trackingNumber: string | null;
}

export interface OrderSummaryDTO {
  number: string;
  placedAt: string;
  status: OrderStatus;
  stage: OrderStage;
  itemCount: number;
  total: number;
  timeline: { step: TrackingStep; at: string | null }[];
}

export interface PlaceOrderResultDTO {
  order: OrderDTO;
  /** Guest orders only: secret key granting read access to this order. */
  accessKey: string | null;
}

export interface ReviewDTO {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author: string;
  createdAt: string;
  mine: boolean;
}

export interface ReviewListDTO {
  items: ReviewDTO[];
  total: number;
  rating: number;
  count: number;
  /** Whether the current user may post a review (has a delivered order, none yet). */
  canReview: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
