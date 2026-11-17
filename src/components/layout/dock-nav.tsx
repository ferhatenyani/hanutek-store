"use client";

import { usePathname } from "next/navigation";
import { Heart, House, LayoutGrid, Package, ShoppingBag } from "lucide-react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { FloatingDock, type DockItem } from "@/components/ui/floating-dock";

/**
 * Bottom navigation for phones AND tablets (hidden on lg+).
 * Order: Accueil · Boutique · Panier · Favoris · Commandes.
 */
export function DockNav() {
  const pathname = usePathname() ?? "";
  const { cartCount, favorites, ready } = useStore();
  const { m } = useI18n();

  const items: DockItem[] = [
    { title: m.nav.home, icon: <House size={20} strokeWidth={1.9} />, href: "/", active: pathname === "/" },
    {
      title: m.nav.shop,
      icon: <LayoutGrid size={20} strokeWidth={1.9} />,
      href: "/products",
      active: pathname.startsWith("/products"),
    },
    {
      title: m.nav.cart,
      icon: <ShoppingBag size={20} strokeWidth={1.9} />,
      href: "/cart",
      active: pathname === "/cart" || pathname === "/checkout",
      badge: ready ? cartCount : 0,
    },
    {
      title: m.nav.favorites,
      icon: <Heart size={20} strokeWidth={1.9} />,
      href: "/favorites",
      active: pathname.startsWith("/favorites"),
      badge: ready ? favorites.length : 0,
    },
    {
      title: m.nav.orders,
      icon: <Package size={20} strokeWidth={1.9} />,
      href: "/profile?tab=orders",
      active: pathname.startsWith("/profile") || pathname.startsWith("/order"),
    },
  ];

  return (
    <div className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <FloatingDock items={items} />
    </div>
  );
}
