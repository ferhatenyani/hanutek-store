import {
  BarChart3,
  Boxes,
  FolderTree,
  Mail,
  MessageSquareText,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  TicketPercent,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "./session";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  /** two-key shortcut: "g" then this key */
  key?: string;
  keywords?: string;
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "",
    items: [{ href: "/admin", label: "Overview", icon: BarChart3, permission: "orders:read", key: "h", keywords: "dashboard analytics home stats" }],
  },
  {
    section: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ReceiptText, permission: "orders:read", key: "o", keywords: "payments refunds cod" },
      { href: "/admin/shipping", label: "Shipping", icon: Truck, permission: "orders:read", key: "s", keywords: "fulfillment carriers delivery shipments" },
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers:read", key: "c", keywords: "clients users accounts" },
      { href: "/admin/promotions", label: "Promotions", icon: TicketPercent, permission: "promotions:write", key: "m", keywords: "discount codes coupons campaigns" },
    ],
  },
  {
    section: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, permission: "catalog:read", key: "p", keywords: "catalog items variants" },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "catalog:read", key: "i", keywords: "stock sku warehouse" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "catalog:read", keywords: "collections" },
      { href: "/admin/reviews", label: "Reviews", icon: MessageSquareText, permission: "reviews:moderate", key: "r", keywords: "ratings moderation" },
    ],
  },
  {
    section: "Workspace",
    items: [
      { href: "/admin/subscribers", label: "Subscribers", icon: Mail, permission: "customers:read", keywords: "newsletter emails marketing" },
      { href: "/admin/team", label: "Team & roles", icon: ShieldCheck, permission: "customers:read", key: "t", keywords: "staff admins permissions access" },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "audit:read", key: "a", keywords: "activity history security" },
      { href: "/admin/settings", label: "Settings", icon: Settings, key: ",", keywords: "account password theme system tools" },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((s) => s.items);

export function activeNav(pathname: string) {
  return [...ALL_NAV].sort((a, b) => b.href.length - a.href.length).find((n) => (n.href === "/admin" ? pathname === "/admin" : pathname === n.href || pathname.startsWith(n.href + "/")));
}
