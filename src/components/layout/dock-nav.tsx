"use client";

import { usePathname } from "next/navigation";
import { Heart, House, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { FloatingDock, type DockItem } from "@/components/ui/floating-dock";
import { navTypes } from "@/components/nav-transition";

/**
 * Bottom navigation for phones AND tablets (hidden on lg+).
 * Order: Accueil · Boutique · Panier · Favoris · Profil.
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
      title: m.nav.profile,
      icon: <User size={20} strokeWidth={1.9} />,
      href: "/profile",
      active: pathname.startsWith("/profile"),
    },
  ].map((item) => ({ ...item, transitionTypes: navTypes(pathname, item.href) }));

  return (
    <div
      className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ viewTransitionName: "site-dock" }}
    >
      <FloatingDock items={items} />
    </div>
  );
}
