"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, Search, ShoppingBag, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useSheetUI } from "./app-shell";

/* Full-width mobile tab bar — soft active pill, in-place spring (RTL-safe). */

type NavItem = {
  key: string;
  label: string;
  icon: typeof House;
  href?: string;
  action?: () => void;
  active: boolean;
  badge?: number;
};

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const { cartCount, user, ready } = useStore();
  const { openCart, openSearch } = useSheetUI();
  const { m } = useI18n();

  const items: NavItem[] = [
    { key: "home", label: m.nav.home, icon: House, href: "/", active: pathname === "/" },
    { key: "shop", label: m.nav.shop, icon: LayoutGrid, href: "/products", active: pathname.startsWith("/products") },
    { key: "search", label: m.nav.search, icon: Search, action: openSearch, active: false },
    { key: "cart", label: m.nav.cart, icon: ShoppingBag, action: openCart, active: pathname === "/cart", badge: cartCount },
    {
      key: "account",
      label: m.nav.account,
      icon: UserRound,
      href: ready && user ? "/profile" : "/login",
      active: pathname.startsWith("/profile") || pathname === "/login" || pathname === "/register",
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label={m.nav.menu}
    >
      <div className="grid h-16 grid-cols-5">
        {items.map((item) => {
          const inner = (
            <>
              <AnimatePresence>
                {item.active && (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", damping: 26, stiffness: 380 }}
                    className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-accent-soft"
                  />
                )}
              </AnimatePresence>
              <span className="relative">
                <item.icon size={20} strokeWidth={item.active ? 2.2 : 1.8} />
                {item.badge !== undefined && item.badge > 0 && ready && (
                  <span className="absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-medium text-white">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className={cn("relative text-[10px]", item.active ? "font-medium" : "font-normal")}>{item.label}</span>
            </>
          );
          const cls = cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60",
            item.active ? "text-accent-ink" : "text-muted",
          );
          return item.href ? (
            <Link key={item.key} href={item.href} transitionTypes={["nav-forward"]} className={cls} aria-current={item.active ? "page" : undefined} aria-label={item.label}>
              {inner}
            </Link>
          ) : (
            <button key={item.key} type="button" onClick={item.action} className={cls} aria-label={item.label}>
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
