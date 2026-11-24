import type { OrderStatus } from "@/lib/api-types";

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; hint: string }> = {
  pending: { label: "Pending", tone: "amber", hint: "Placed, waiting for confirmation" },
  confirmed: { label: "Confirmed", tone: "blue", hint: "Confirmed with the customer" },
  packed: { label: "Packed", tone: "violet", hint: "Ready to hand to the carrier" },
  shipped: { label: "Shipped", tone: "blue", hint: "With the carrier" },
  out_for_delivery: { label: "Out for delivery", tone: "blue", hint: "On the way to the customer" },
  delivered: { label: "Delivered", tone: "green", hint: "Delivered, cash collected" },
  cancelled: { label: "Cancelled", tone: "neutral", hint: "Cancelled; stock restored" },
  returned: { label: "Returned", tone: "red", hint: "Returned; stock restored" },
};
export const ORDER_STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[];

/** Verb used on the action button that moves an order INTO this status. */
export const TRANSITION_VERB: Record<OrderStatus, string> = {
  pending: "Reopen",
  confirmed: "Confirm",
  packed: "Mark packed",
  shipped: "Ship",
  out_for_delivery: "Out for delivery",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
  returned: "Mark returned",
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  paid: { label: "Paid", tone: "green" },
  refunded: { label: "Refunded", tone: "red" },
};

export const PRODUCT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  draft: { label: "Draft", tone: "neutral" },
  archived: { label: "Archived", tone: "amber" },
};

export const ROLE: Record<string, { label: string; tone: Tone }> = {
  customer: { label: "Customer", tone: "neutral" },
  staff: { label: "Staff", tone: "blue" },
  admin: { label: "Admin", tone: "violet" },
};

export const MOVEMENT_REASON: Record<string, { label: string; tone: Tone }> = {
  order: { label: "Order", tone: "neutral" },
  cancel: { label: "Cancellation", tone: "amber" },
  return: { label: "Return", tone: "red" },
  adjustment: { label: "Adjustment", tone: "blue" },
  restock: { label: "Restock", tone: "green" },
};

export const PERMISSION_LABEL: Record<string, string> = {
  "catalog:read": "View catalogue",
  "catalog:write": "Edit products & categories",
  "inventory:write": "Adjust stock",
  "orders:read": "View orders & analytics",
  "orders:write": "Process orders",
  "customers:read": "View customers",
  "customers:write": "Disable customers, sign out sessions",
  "promotions:write": "Manage discount codes",
  "reviews:moderate": "Moderate reviews",
  "media:write": "Upload product images",
  "audit:read": "Read the audit log",
  "users:manage_roles": "Change roles",
  "settings:manage": "Carriers & system tools",
};

/** "product.bulk_update" → "Product bulk update" */
export function actionLabel(action: string) {
  const s = action.replace(/[._]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
