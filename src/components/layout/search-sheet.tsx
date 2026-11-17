"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { products, variantPrice } from "@/lib/products";
import { useI18n } from "@/i18n";
import { Sheet } from "@/components/ui/sheet";

export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const { m, t, price, isRTL } = useI18n();

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return products
      .filter((p) => `${p.name} ${p.category} ${p.short}`.toLowerCase().includes(s))
      .slice(0, 6);
  }, [q]);

  const popular = products.filter((p) => p.bestSeller).slice(0, 4);
  const list = q.trim() ? results : popular;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side={isRTL ? "left" : "right"}
      title={m.nav.search}
      showTitleBar={false}
      panelClassName="w-[92vw]! max-w-[420px]!"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-line p-4">
          <div className="relative flex-1">
            <Search size={17} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={m.header.searchPlaceholder}
              aria-label={m.header.searchPlaceholder}
              className="h-11 w-full rounded-full border border-line bg-surface ps-10 pe-4 text-sm transition-colors duration-200 ease-out-quint placeholder:text-faint focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
            />
          </div>
          <button
            onClick={onClose}
            aria-label={m.common.close}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint rtl:tracking-normal">
            {q.trim() ? t("shell.searchResults", { n: results.length }) : m.shell.searchPopular}
          </p>
          {list.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted">{t("shell.searchEmpty", { q })}</p>
              <Link
                href="/products"
                onClick={onClose}
                className="mt-3 inline-block cursor-pointer text-sm font-semibold text-accent underline-offset-4 hover:underline"
              >
                {m.shell.browseAll}
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {list.map((p) => (
                <Link
                  key={p.slug}
                  href={`/products/${p.slug}`}
                  onClick={onClose}
                  className="flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors duration-200 ease-out-quint hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" className="h-12 w-12 rounded-lg border border-line object-cover" />
                  <span className="min-w-0 flex-1">
                    <span dir="ltr" className="block truncate text-sm font-medium rtl:text-right">{p.name}</span>
                    <span className="block text-xs text-muted">{m.categories[p.category].name}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {price(variantPrice(p, p.variants[0].id))}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {q.trim() && results.length > 0 && (
            <Link
              href={`/products?q=${encodeURIComponent(q)}`}
              onClick={onClose}
              className="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line py-2.5 text-sm font-medium transition-colors hover:bg-surface"
            >
              {m.shell.browseAll} <ArrowRight size={15} className="rtl:rotate-180" />
            </Link>
          )}
        </div>
      </div>
    </Sheet>
  );
}
