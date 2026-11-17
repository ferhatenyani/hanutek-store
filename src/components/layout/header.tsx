"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { categories } from "@/lib/products";
import { cn } from "@/lib/utils";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { useSheetUI } from "./app-shell";

const iconBtn =
  "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-surface hover:text-foreground";

export function Header() {
  const pathname = usePathname();
  return <HeaderView pathname={pathname} />;
}

export function HeaderView({ pathname }: { pathname: string | null }) {
  const { cartCount, user, ready } = useStore();
  const { openCart, openSearch, openMenu } = useSheetUI();

  const isActive = (href: string) =>
    pathname === null ? false : href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <div className="flex h-8 items-center justify-center border-b border-line bg-surface px-4 text-xs">
        <AnimatedShinyText shimmerWidth={140} className="text-muted">
          Free shipping over €50
          <span className="hidden sm:inline"> · 30-day returns · 2-year warranty</span>
        </AnimatedShinyText>
      </div>

      <header className="sticky top-0 z-50 border-b border-line bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:gap-6 md:px-6">
          <button type="button" className={cn(iconBtn, "md:hidden")} onClick={openMenu} aria-label="Open menu">
            <Menu size={20} />
          </button>

          <Link href="/" transitionTypes={["nav-forward"]} className="flex items-center gap-2" aria-label="Hanutek home">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground font-mono text-sm text-background">
              h
            </span>
            <span className="text-[17px] font-semibold tracking-tight">
              hanutek<span className="text-accent">.</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
            <Link
              href="/"
              transitionTypes={["nav-forward"]}
              className={cn(
                "rounded-full px-3 py-2 text-sm transition-colors",
                isActive("/") ? "bg-surface font-medium text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              Home
            </Link>
            <Link
              href="/products"
              transitionTypes={["nav-forward"]}
              className={cn(
                "rounded-full px-3 py-2 text-sm transition-colors",
                isActive("/products") ? "bg-surface font-medium text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              All products
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/products?category=${c.slug}`}
                transitionTypes={["nav-forward"]}
                className="hidden rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-foreground lg:block"
              >
                {c.name.split(" & ")[0]}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <button type="button" className={iconBtn} onClick={openSearch} aria-label="Search products">
              <Search size={19} />
            </button>
            <button type="button" className={iconBtn} onClick={openCart} aria-label={`Open cart, ${cartCount} items`}>
              <ShoppingBag size={19} />
              <AnimatePresence>
                {ready && cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", damping: 18, stiffness: 400 }}
                    className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-white"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <Link
              href={user ? "/profile" : "/login"}
              transitionTypes={["nav-forward"]}
              className={cn(iconBtn, "hidden sm:flex")}
              aria-label={user ? "Your account" : "Sign in"}
            >
              {user ? (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
                  {user.name.slice(0, 1).toUpperCase()}
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