"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, ChevronDown, ChevronLeft, ShoppingBag, Zap } from "lucide-react";
import type { Product } from "@/lib/products";
import { productsInCategory, variantPrice } from "@/lib/products";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { Button, Badge, QtyStepper, SectionHead } from "@/components/ui/primitives";
import { ProductCard } from "@/components/product-card";
import { useToast } from "@/components/ui/toast";

type ProductMsg = {
  short: string;
  description: string;
  specs: string[][];
  inTheBox: string[];
  variants: Record<string, string>;
};

function Accordion({
  items,
}: {
  items: { id: string; title: string; content: React.ReactNode }[];
}) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center justify-between py-4 text-start text-[15px] font-medium transition-colors duration-150 hover:text-accent-ink"
            >
              {item.title}
              <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform duration-200", isOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pb-5 text-sm leading-relaxed text-muted">{item.content}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function ProductDetail({ product }: { product: Product }) {
  const { t, m, price: fmt } = useI18n();
  const router = useRouter();
  const { addToCart } = useStore();
  const toast = useToast();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(1);

  const mp = m.products[product.slug as keyof typeof m.products] as ProductMsg;
  const catName = m.categories[product.category as keyof typeof m.categories].name;
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const price = variantPrice(product, variantId);
  const compareAt = product.compareAt ? product.compareAt + variant.priceDelta : undefined;
  const onSale = compareAt != null && compareAt > price;
  const pct = onSale ? Math.round((1 - price / compareAt!) * 100) : 0;
  const related = productsInCategory(product.category).filter((p) => p.slug !== product.slug);

  const add = () => {
    addToCart(product.slug, variantId, qty);
    toast(`${product.name} · ${m.product.addedToCart}`);
  };
  const buyNow = () => {
    addToCart(product.slug, variantId, qty);
    router.push("/checkout");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 md:px-6 md:pt-10 md:pb-24">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="flex items-center gap-1 transition-colors duration-150 hover:text-foreground">
          <ChevronLeft size={13} className="rtl:rotate-180" /> {m.nav.home}
        </Link>
        <span className="text-faint">/</span>
        <Link
          href={`/products?category=${product.category}`}
          className="transition-colors duration-150 hover:text-foreground"
        >
          {catName}
        </Link>
        <span className="text-faint">/</span>
        <span dir="ltr" className="max-w-40 truncate text-foreground rtl:text-right">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        {/* Imagery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-surface">
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {onSale && <Badge tone="sale"><span dir="ltr">−{pct}%</span></Badge>}
            {product.isNew && <Badge tone="volt">{t("common.new")}</Badge>}
            {product.bestSeller && !product.isNew && <Badge tone="dark">{t("common.bestSeller")}</Badge>}
          </div>
        </div>

        {/* Info + buy box */}
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase rtl:tracking-normal">{catName}</p>
          <h1 dir="ltr" className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl rtl:text-right rtl:tracking-normal">
            {product.name}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{mp.short}</p>

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span dir="ltr" className="num font-display text-2xl font-semibold text-foreground">{fmt(price)}</span>
            {onSale && (
              <>
                <span dir="ltr" className="num font-mono text-sm text-faint line-through">{fmt(compareAt!)}</span>
                <Badge tone="sale">{t("product.save", { amount: fmt(compareAt! - price) })}</Badge>
              </>
            )}
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-muted">
              {m.product.chooseVariant}: <span className="text-foreground">{mp.variants[variantId]}</span>
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={m.product.chooseVariant}>
              {product.variants.map((v) => {
                const active = v.id === variantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      "h-10 cursor-pointer rounded-full border px-4 text-[13px] font-medium transition-colors duration-150",
                      active
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line bg-background text-muted hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {mp.variants[v.id]}
                    {v.priceDelta > 0 && <span dir="ltr" className="num ms-1.5 font-mono text-[11px] opacity-70">+{fmt(v.priceDelta)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* One decision, two clear paths: add to cart OR order this item now */}
          <div className="mt-8 rounded-card border border-line bg-surface/60 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <QtyStepper qty={qty} onChange={setQty} />
              <Button onClick={add} variant="outline" className="flex-1 gap-2">
                <ShoppingBag size={16} /> {m.product.addToCart}
              </Button>
            </div>

            <div className="my-3 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint rtl:tracking-normal">{m.product.orDivider}</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button onClick={buyNow} size="lg" className="w-full gap-2">
              <Zap size={16} /> {m.product.buyNow} · <span dir="ltr" className="num">{fmt(price * qty)}</span>
            </Button>

            <p className="mt-3 text-xs leading-relaxed text-muted">{m.product.actionsHint}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-accent-ink">
              <Banknote size={12} aria-hidden /> {m.product.codNote}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="mt-14 max-w-3xl">
        <Accordion
          items={[
            { id: "description", title: m.product.descriptionTitle, content: <p>{mp.description}</p> },
            {
              id: "specs",
              title: m.product.specsTitle,
              content: (
                <table className="w-full">
                  <tbody className="divide-y divide-line">
                    {mp.specs.map(([k, v]) => (
                      <tr key={k}>
                        <td className="w-40 py-2.5 pe-4 align-top text-xs text-faint">{k}</td>
                        <td className="py-2.5 text-[13px] text-foreground">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
            },
            {
              id: "box",
              title: m.product.inTheBoxTitle,
              content: (
                <ul className="list-disc space-y-1 ps-5">
                  {mp.inTheBox.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <SectionHead eyebrow={catName} title={m.product.relatedTitle} className="mb-6 md:mb-8" />
          <div className="product-rail no-scrollbar">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
