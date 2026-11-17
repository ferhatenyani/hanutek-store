"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, Search, ShoppingBag, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useSheetUI } from "./app-shell";

export function BottomNav() {
  const pathname = usePathname();
  return <BottomNavView pathname={pathname} />;
}

export function BottomNavView({ pathname: raw }: { pathname: string | null }) {
  const pathname = raw ?? "";
  const { cartCount, user, ready } = useStore();
  const { openCart, openSearch } = useSheetUI();

  const items = [
    { key: "home", label: "Home", icon: House, href: "/", active: pathname === "/" },
    {
      key: "shop",
      label: "Shop",
      icon: LayoutGrid,
      href: "/products",
      active: pathname.startsWith("/products"),
    },
    { key: "search", label: "Search", icon: Search, action: openSearch, active: false },
    { key: "cart", label: "Cart", icon: ShoppingBag, action: openCart, active: pathname === "/cart", badge: cartCount },
    {
      key: "account",
      label: user ? "Account" : "Sign in",
      icon: UserRound,
      href: user ? "/profile" : "/login",
      active: pathname.startsWith("/profile") || pathname === "/login" || pathname === "/register",
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Mobile"
    >
      <div className="grid h-16 grid-cols-5">
        {items.map((item) => {
          const inner = (
            <>
              {item.active && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-accent-soft"
                  transition={{ type: "spring", damping: 30, stiffness: 350 }}
                />
              )}
              <span className="relative">
                <item.icon size={20} strokeWidth={item.active ? 2.2 : 1.8} />
                {item.badge !== undefined && item.badge > 0 && ready && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-medium text-white">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className={cn("relative text-[10px]", item.active ? "font-medium" : "font-normal")}>
                {item.label}
              </span>
            </>
          );
          const cls = cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-1 transition-colors",
            item.active ? "text-accent-ink" : "text-muted",
          );
          return item.href ? (
            <Link key={item.key} href={item.href} transitionTypes={["nav-forward"]} className={cls} aria-label={item.label}>
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