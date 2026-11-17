"use client";

import Link from "next/link";
import { ChevronRight, House, LayoutGrid, ShoppingBag, UserRound } from "lucide-react";
import { categories } from "@/lib/products";
import { useStore } from "@/lib/store";
import { categoryIcons } from "@/components/icons";
import { Sheet } from "@/components/ui/sheet";
import { useSheetUI } from "./app-shell";

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, cartCount } = useStore();
  const { openCart } = useSheetUI();

  const row = "flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors hover:bg-surface";

  return (
    <Sheet open={open} onClose={onClose} side="left">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground font-mono text-sm text-background">h</span>
          <span className="text-[17px] font-semibold tracking-tight">
            hanutek<span className="text-accent">.</span>
          </span>
        </span>
      </div>

      <nav className="flex-1 px-3 py-4" aria-label="Menu">
        <Link href="/" transitionTypes={["nav-forward"]} onClick={onClose} className={row}>
          <House size={18} className="text-muted" /> Home
        </Link>
        <Link href="/products" transitionTypes={["nav-forward"]} onClick={onClose} className={row}>
          <LayoutGrid size={18} className="text-muted" /> All products
        </Link>

        <p className="mt-5 mb-2 px-3 font-mono text-[10px] tracking-[0.16em] text-faint uppercase">Categories</p>
        {categories.map((c) => {
          const Icon = categoryIcons[c.slug];
          return (
            <Link
              key={c.slug}
              href={`/products?category=${c.slug}`}
              transitionTypes={["nav-forward"]}
              onClick={onClose}
              className={row}
            >
              <Icon size={18} className="text-muted" />
              <span className="flex-1">{c.name}</span>
              <ChevronRight size={15} className="text-faint" />
            </Link>
          );
        })}

        <p className="mt-5 mb-2 px-3 font-mono text-[10px] tracking-[0.16em] text-faint uppercase">You</p>
        <button
          type="button"
          onClick={() => {
            onClose();
            setTimeout(openCart, 220);
          }}
          className={`${row} w-full cursor-pointer`}
        >
          <ShoppingBag size={18} className="text-muted" />
          <span className="flex-1 text-left">Cart</span>
          {cartCount > 0 && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent-ink">{cartCount}</span>
          )}
        </button>
        <Link
          href={user ? "/profile" : "/login"}
          transitionTypes={["nav-forward"]}
          onClick={onClose}
          className={row}
        >
          <UserRound size={18} className="text-muted" />
          {user ? "Your profile" : "Sign in / Register"}
        </Link>
      </nav>

      <div className="border-t border-line px-5 py-4 text-xs text-faint">
        Free shipping over €50 · 30-day returns
      </div>
    </Sheet>
  );
}