"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Heart, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { SearchBar } from "./search-bar";
import { useSheetUI } from "./app-shell";
import { navTypes } from "@/components/nav-transition";
import type { Locale } from "@/i18n/config";

const iconBtn =
  "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-foreground/80 transition-colors duration-150 hover:bg-accent-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30";

/** Segmented FR / AR switcher (Ink + Volt). */
export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale, m } = useI18n();
  const opts: { id: Locale; label: string }[] = [
    { id: "fr", label: "FR" },
    { id: "ar", label: "عربي" },
  ];
  return (
    <div
      role="group"
      aria-label={m.shell.locale}
      className={cn("flex items-center rounded-full border border-line bg-surface p-0.5", className)}
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setLocale(o.id)}
          aria-pressed={locale === o.id}
          className={cn(
            "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
            locale === o.id ? "bg-accent text-white" : "text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const { cartCount, favorites, user, ready } = useStore();
  const { openCart } = useSheetUI();
  const { m } = useI18n();
  const [mobileSearch, setMobileSearch] = useState(false);

  // The header persists across navigations — close the expanded search row on
  // route change. Adjust state during render (React's recommended alternative
  // to a setState-in-effect) so no extra effect/render pass is needed.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileSearch(false);
  }

  return (
    <>
      {/* static announcement strip — promo code visible everywhere */}
      <div
        className="flex h-8 items-center justify-center gap-1.5 border-b border-line bg-accent-soft px-4 text-center font-mono text-[11px] font-medium text-accent-ink"
        style={{ viewTransitionName: "site-announcement" }}
      >
        {m.header.promo} · {m.cart.codBadge}
      </div>

      <header
        className="sticky top-0 z-50 border-b border-line bg-background/95 backdrop-blur-md"
        style={{ viewTransitionName: "site-header" }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 lg:h-16 lg:gap-5 lg:px-6">
          {/* logo — always left */}
          <Link
            href="/"
            transitionTypes={navTypes(pathname, "/")}
            className="flex shrink-0 items-center gap-2"
            aria-label="hanutek"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground font-mono text-sm text-background">
              h
            </span>
            <span className="text-[17px] font-semibold tracking-tight rtl:tracking-normal">
              hanutek<span className="text-accent">.</span>
            </span>
          </Link>

          {/* desktop: searchbar lives in the navbar (no filter links) */}
          <div className="mx-auto hidden w-full max-w-md lg:block">
            <SearchBar />
          </div>

          <div className="ms-auto flex items-center gap-0.5 lg:gap-1.5">
            {/* mobile / tablet: search icon (expands the bar below) */}
            <button
              type="button"
              className={cn(iconBtn, "lg:hidden")}
              onClick={() => setMobileSearch((s) => !s)}
              aria-label={m.header.openSearch}
              aria-expanded={mobileSearch}
            >
              {mobileSearch ? <X size={19} /> : <Search size={19} />}
            </button>

            {/* favorites — back in the navbar (md+; phone reaches it via the dock) */}
            <Link
              href="/favorites"
              transitionTypes={navTypes(pathname, "/favorites")}
              className={cn(iconBtn, "hidden md:flex")}
              aria-label={`${m.header.openFavorites} (${favorites.length})`}
              aria-current={pathname.startsWith("/favorites") ? "page" : undefined}
            >
              <Heart size={19} className={cn(pathname.startsWith("/favorites") && "fill-current")} />
              {ready && favorites.length > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-white">
                  {favorites.length}
                </span>
              )}
            </Link>

            {/* cart — tablet/desktop open the sheet; phone uses the dock */}
            <button type="button" className={cn(iconBtn, "hidden md:flex")} onClick={openCart} aria-label={`${m.header.openCart} (${cartCount})`}>
              <ShoppingBag size={19} />
              {ready && cartCount > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* profile — desktop header; on phones/tablets it lives in the dock,
                and this slot becomes the language switcher */}
            <Link
              href={ready && user ? "/profile" : "/login"}
              transitionTypes={navTypes(pathname, ready && user ? "/profile" : "/login")}
              className={cn(iconBtn, "hidden lg:flex")}
              aria-label={m.header.openAccount}
            >
              {ready && user ? (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <UserRound size={19} />
              )}
            </Link>

            <LocaleToggle className="flex" />
          </div>
        </div>

        {/* mobile / tablet: expandable search row inside the sticky header */}
        {mobileSearch && (
          <div className="border-t border-line px-4 py-3 lg:hidden">
            <SearchBar autoFocus />
          </div>
        )}
      </header>
    </>
  );
}
