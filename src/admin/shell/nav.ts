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
    items: [{ href: "/admin", label: "Vue d’ensemble", icon: BarChart3, permission: "orders:read", key: "h", keywords: "tableau de bord statistiques accueil dashboard" }],
  },
  {
    section: "Ventes",
    items: [
      { href: "/admin/orders", label: "Commandes", icon: ReceiptText, permission: "orders:read", key: "o", keywords: "paiements remboursements livraison commandes" },
      { href: "/admin/shipping", label: "Expéditions", icon: Truck, permission: "orders:read", key: "s", keywords: "transporteurs livraison expéditions colis" },
      { href: "/admin/customers", label: "Clients", icon: Users, permission: "customers:read", key: "c", keywords: "clients utilisateurs comptes" },
      { href: "/admin/promotions", label: "Promotions", icon: TicketPercent, permission: "promotions:write", key: "m", keywords: "codes promo réductions coupons campagnes" },
    ],
  },
  {
    section: "Catalogue",
    items: [
      { href: "/admin/products", label: "Produits", icon: Package, permission: "catalog:read", key: "p", keywords: "catalogue articles variantes" },
      { href: "/admin/inventory", label: "Stock", icon: Boxes, permission: "catalog:read", key: "i", keywords: "stock sku entrepôt inventaire" },
      { href: "/admin/categories", label: "Catégories", icon: FolderTree, permission: "catalog:read", keywords: "collections rayons" },
      { href: "/admin/reviews", label: "Avis", icon: MessageSquareText, permission: "reviews:moderate", key: "r", keywords: "notes modération" },
    ],
  },
  {
    section: "Espace de travail",
    items: [
      { href: "/admin/subscribers", label: "Abonnés", icon: Mail, permission: "customers:read", keywords: "newsletter e-mails marketing" },
      { href: "/admin/team", label: "Équipe et rôles", icon: ShieldCheck, permission: "customers:read", key: "t", keywords: "équipe administrateurs permissions accès" },
      { href: "/admin/audit", label: "Journal d’audit", icon: ScrollText, permission: "audit:read", key: "a", keywords: "activité historique sécurité" },
      { href: "/admin/settings", label: "Paramètres", icon: Settings, key: ",", keywords: "compte mot de passe thème système outils" },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((s) => s.items);

export function activeNav(pathname: string) {
  return [...ALL_NAV].sort((a, b) => b.href.length - a.href.length).find((n) => (n.href === "/admin" ? pathname === "/admin" : pathname === n.href || pathname.startsWith(n.href + "/")));
}
