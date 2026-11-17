"use client";

import Link from "next/link";
import { ChevronRight, House, LayoutGrid, ShoppingBag, UserRound, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { categories } from "@/lib/products";
import { Sheet } from "@/components/ui/sheet";
import { LocaleToggle } from "./header";

const rowCls =
  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors duration-200 ease-out-quint hover:bg-surface active:bg-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60";
const labelCls =
  "px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint rtl:tracking-normal";

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, ready } = useStore();
  const { m, isRTL } = useI18n();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side={isRTL ? "right" : "left"}
      title={m.nav.menu}
      showTitleBar={false}
      panelClassName="w-[86vw]! max-w-[340px]!"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground font-display text-sm font-bold text-volt">
              h
            </span>
            <span className="font-display text-lg font-bold">
              hanutek<span className="text-volt">.</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label={m.common.close}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <Link href="/" onClick={onClose} className={rowCls}>
            <House size={18} className="text-muted" /> {m.nav.home}
          </Link>
          <Link href="/products" onClick={onClose} className={rowCls}>
            <LayoutGrid size={18} className="text-muted" /> {m.nav.allProducts}
          </Link>

          <p className={labelCls}>{m.shell.categories}</p>
          {categories.map((c) => (
            <Link key={c.slug} href={`/products?category=${c.slug}`} onClick={onClose} className={rowCls}>
              <span className="h-2 w-2 rounded-full bg-volt" />
              {m.categories[c.slug].name}
              <ChevronRight size={15} className="ms-auto text-faint rtl:rotate-180" />
            </Link>
          ))}

          <p className={labelCls}>{m.shell.you}</p>
          <Link href="/cart" onClick={onClose} className={rowCls}>
            <ShoppingBag size={18} className="text-muted" /> {m.nav.cart}
          </Link>
          {ready && user ? (
            <Link href="/profile" onClick={onClose} className={rowCls}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-ink">
                {user.name.charAt(0).toUpperCase()}
              </span>
              {m.shell.yourProfile}
            </Link>
          ) : (
            <Link href="/login" onClick={onClose} className={rowCls}>
              <UserRound size={18} className="text-muted" /> {m.shell.signInRegister}
            </Link>
          )}
        </nav>

        <div className="space-y-3 border-t border-line p-4">
          <div className="flex justify-center">
            <LocaleToggle />
          </div>
          <p className="text-center text-xs text-muted">{m.header.announcement}</p>
        </div>
      </div>
    </Sheet>
  );
}
