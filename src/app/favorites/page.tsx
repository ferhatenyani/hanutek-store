"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { getProduct } from "@/lib/products";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { buttonClasses } from "@/components/ui/primitives";
import { ProductCard } from "@/components/product-card";
import { NavTransition } from "@/components/nav-transition";

export default function FavoritesPage() {
  const { favorites, ready } = useStore();
  const { m } = useI18n();

  const list = favorites.map(getProduct).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <NavTransition>
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14">
      <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight md:text-4xl">
        <Heart size={26} className="text-sale" aria-hidden />
        {m.favorites.title}
        {ready && list.length > 0 && (
          <span className="num font-mono text-lg font-normal text-faint">({list.length})</span>
        )}
      </h1>

      {!ready ? (
        <div className="product-grid mt-7 md:mt-8" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent">
              <div className="aspect-square animate-pulse bg-line/50 max-lg:rounded-[18px]" />
              <div className="space-y-2.5 p-4 max-lg:space-y-2 max-lg:px-1 max-lg:pb-0 max-lg:pt-2.5">
                <div className="h-3 w-1/3 animate-pulse rounded bg-line/60 max-lg:hidden" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-line/60" />
                <div className="h-9 w-full animate-pulse rounded-full bg-line/50 max-lg:h-3 max-lg:w-1/2 max-lg:rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-card border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-ink">
            <Heart size={22} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold">{m.favorites.emptyTitle}</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">{m.favorites.emptyDesc}</p>
          <Link href="/products" transitionTypes={["nav-back"]} className={buttonClasses("primary", "md", "mt-6")}>
            {m.favorites.browseCta}
          </Link>
        </div>
      ) : (
        <div className="product-grid mt-7 md:mt-8">
          {list.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
    </NavTransition>
  );
}
