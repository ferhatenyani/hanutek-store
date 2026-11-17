"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { categories } from "@/lib/products";
import { cn } from "@/lib/utils";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { useSheetUI } from "./app-shell";
import type { Locale } from "@/i18n/config";

const iconBtn =
  "relative grid h-10 w-10 cursor-pointer place-items-center rounded-full text-foreground transition-all duration-200 ease-out-quint hover:bg-accent-soft active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60";

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
      className={cn(
        "flex items-center rounded-full border border-line bg-surface p-0.5",
        className,
      )}
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setLocale(o.id)}
          aria-pressed={locale === o.id}
          className={cn(
            "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ease-out-quint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60",
            locale === o.id
              ? "bg-accent text-white shadow-sm"
              : "text-muted hover:text-foreground",
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
  const { cartCount, user, ready } = useStore();
  const { openMenu, openSearch, openCart } = useSheetUI();
  const { m } = useI18n();

  const links = [
    { href: "/", label: m.nav.home },
    { href: "/products", label: m.nav.allProducts },
    ...categories.map((c) => ({
      href: `/products?category=${c.slug}`,
      label: m.categories[c.slug].name,
    })),
  ];
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/products" ? pathname === "/products" : false;

  return (
    <header className="sticky top-0 z-40">
      {/* announcement bar */}
      <div className="bg-foreground text-background">
        <div className="container-x flex h-9 items-center justify-center gap-3 text-center text-xs font-medium">
          <AnimatedShinyText
            shimmerWidth={120}
            className="text-background/90 [--color:rgba(255,255,255,0.65)] [--shimmer-color:rgba(255,255,255,0.95)]"
          >
            {m.header.announcement}
          </AnimatedShinyText>
          <span className="hidden shrink-0 rounded-full bg-volt/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-volt md:inline">
            {m.header.promo}
          </span>
        </div>
      </div>

      {/* main bar */}
      <div className="glass-strong border-b border-line">
        <div className="container-x flex h-16 items-center">
          <button
            className={cn(iconBtn, "me-1 md:hidden")}
            aria-label={m.header.openMenu}
            onClick={openMenu}
          >
            <Menu size={21} />
          </button>

          <Link href="/" className="flex items-center gap-2" aria-label="hanutek">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground font-display text-sm font-bold text-volt">
              h
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              hanutek<span className="text-volt">.</span>
            </span>
          </Link>

          <nav className="ms-8 hidden items-center gap-0.5 md:flex" aria-label={m.nav.menu}>
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors duration-200 ease-out-quint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60",
                    active ? "font-semibold text-white" : "text-muted hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-accent"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10">{l.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex items-center gap-1 md:gap-2">
            <LocaleToggle className="hidden md:flex" />
            <button className={iconBtn} aria-label={m.header.openSearch} onClick={openSearch}>
              <Search size={20} />
            </button>
            <button className={iconBtn} aria-label={`${m.header.openCart} (${cartCount})`} onClick={openCart}>
              <ShoppingBag size={20} />
              <AnimatePresence>
                {ready && cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
                    className="absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-volt px-1 text-[10px] font-bold text-foreground"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <Link
              href={ready && user ? "/profile" : "/login"}
              className={iconBtn}
              aria-label={m.header.openAccount}
            >
              {ready && user ? (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <UserRound size={20} />
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
