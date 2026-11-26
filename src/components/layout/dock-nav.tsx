"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Heart, House, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { FloatingDock, type DockItem } from "@/components/ui/floating-dock";
import { navTypes } from "@/components/nav-transition";
import { useSheetUI } from "./app-shell";

const TEXT_ENTRY = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, [contenteditable="true"]';

/**
 * True while a text field has focus — i.e. while the on-screen keyboard is
 * (almost certainly) up. Android shrinks the viewport and iOS keeps fixed
 * elements on the layout viewport, so a bottom-fixed dock otherwise floats
 * over the very field being filled in.
 */
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(t);
      // defer: moving focus between two fields must not flash the dock
      t = setTimeout(() => setTyping(Boolean((document.activeElement as Element | null)?.matches?.(TEXT_ENTRY))), 60);
    };
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    return () => {
      clearTimeout(t);
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
    };
  }, []);
  return typing;
}

/**
 * Bottom navigation for phones AND tablets (hidden on lg+).
 * Order: Accueil · Boutique · Panier · Favoris · Profil.
 */
export function DockNav() {
  const pathname = usePathname() ?? "";
  const { cartCount, favorites, ready } = useStore();
  const { openCart } = useSheetUI();
  const { m } = useI18n();
  const typing = useTyping();

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
      // Phones + tablets open the expandable sheet — never a separate cart page.
      onClick: openCart,
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
  ].map((item) => ({ ...item, transitionTypes: item.href ? navTypes(pathname, item.href) : undefined }));

  return (
    <div
      data-typing={typing || undefined}
      inert={typing}
      className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-2 pb-[env(safe-area-inset-bottom)] min-[360px]:px-4 transition-[translate,opacity] duration-200 ease-out data-[typing]:pointer-events-none data-[typing]:translate-y-[calc(100%+1.5rem)] data-[typing]:opacity-0 lg:hidden"
      style={{ viewTransitionName: "site-dock" }}
    >
      <FloatingDock items={items} />
    </div>
  );
}
