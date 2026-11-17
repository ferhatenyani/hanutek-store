"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { products, categoryBySlug, variantPrice } from "@/lib/products";
import { formatPrice } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { buttonClasses } from "@/components/ui/primitives";

export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.filter((p) => p.bestSeller || p.featured).slice(0, 6);
    return products.filter((p) =>
      [p.name, p.short, categoryBySlug[p.category].name, p.category].join(" ").toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Sheet open={open} onClose={onClose} side="right" title="Search">
      <div className="border-b border-line px-5 py-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dash cams, mounts, jump starters…"
            aria-label="Search products"
            className="h-11 w-full rounded-xl border border-line bg-surface pr-4 pl-10 text-sm placeholder:text-faint focus:border-accent focus:bg-background focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 px-5 py-4">
        <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-faint uppercase">
          {query.trim() ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Popular right now"}
        </p>

        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <SearchX size={26} className="text-faint" />
            <p className="text-sm text-muted">
              Nothing matches <span className="font-medium text-foreground">“{query}”</span>
            </p>
            <Link href="/products" transitionTypes={["nav-forward"]} onClick={onClose} className={buttonClasses("outline", "sm")}>
              Browse all products
            </Link>
          </div>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false} mode="popLayout">
              {results.map((p) => (
                <motion.li
                  key={p.slug}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                >
                  <Link
                    href={`/products/${p.slug}`}
                    transitionTypes={["nav-forward"]}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface"
                  >
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
                      <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{categoryBySlug[p.category].name}</span>
                    </span>
                    <span className="font-mono text-sm">{formatPrice(variantPrice(p, p.variants[0].id))}</span>
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Sheet>
  );
}