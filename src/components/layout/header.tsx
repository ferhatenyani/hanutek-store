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
  "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60";

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
            "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60",
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
  const { cartCount, user, ready } = useStore();
  const { openCart, openSearch, openMenu } = useSheetUI();
  const { m } = useI18n();

  const isActive = (href: string) =>
    pathname === null ? false : href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* announcement bar — light surface, simple */}
      <div className="flex h-8 items-center justify-center border-b border-line bg-surface px-4 text-xs">
        <AnimatedShinyText shimmerWidth={140} className="text-muted">
          {m.header.announcement}
        </AnimatedShinyText>
      </div>

      <header className="sticky top-0 z-50 border-b border-line bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:gap-6 md:px-6">
          <button type="button" className={cn(iconBtn, "md:hidden")} onClick={openMenu} aria-label={m.header.openMenu}>
            <Menu size={20} />
          </button>

          <Link href="/" transitionTypes={["nav-forward"]} className="flex items-center gap-2" aria-label="hanutek">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground font-mono text-sm text-background">
              h
            </span>
            <span className="text-[17px] font-semibold tracking-tight rtl:tracking-normal">
              hanutek<span className="text-accent">.</span>
            </span>
          </Link>

          <nav className="ms-4 hidden items-center gap-1 md:flex" aria-label={m.nav.menu}>
            <Link
              href="/"
              transitionTypes={["nav-forward"]}
              aria-current={isActive("/") ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-2 text-sm transition-colors",
                isActive("/") ? "bg-surface font-medium text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {m.nav.home}
            </Link>
            <Link
              href="/products"
              transitionTypes={["nav-forward"]}
              aria-current={isActive("/products") ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-2 text-sm transition-colors",
                isActive("/products") ? "bg-surface font-medium text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {m.nav.allProducts}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/products?category=${c.slug}`}
                transitionTypes={["nav-forward"]}
                className="hidden rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-foreground lg:block"
              >
                {m.categories[c.slug].short}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-0.5 md:gap-1.5">
            <LocaleToggle className="hidden md:flex" />
            <button type="button" className={iconBtn} onClick={openSearch} aria-label={m.header.openSearch}>
              <Search size={19} />
            </button>
            <button type="button" className={iconBtn} onClick={openCart} aria-label={`${m.header.openCart} (${cartCount})`}>
              <ShoppingBag size={19} />
              <AnimatePresence>
                {ready && cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", damping: 18, stiffness: 400 }}
                    className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-white"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <Link
              href={ready && user ? "/profile" : "/login"}
              transitionTypes={["nav-forward"]}
              className={cn(iconBtn, "hidden sm:flex")}
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
          </div>
        </div>
      </header>
    </>
  );
}
