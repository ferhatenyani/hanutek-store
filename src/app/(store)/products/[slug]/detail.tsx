"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, ChevronDown, ChevronLeft, ShoppingBag, Zap } from "lucide-react";
import type { ProductDTO } from "@/lib/api-types";
import { tr, useCategoryLabel } from "@/lib/catalog-client";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { Button, Badge, QtyStepper, SectionHead } from "@/components/ui/primitives";
import { ProductCard } from "@/components/product-card";
import { useToast } from "@/components/ui/toast";
import { NavTransition, stampNav } from "@/components/nav-transition";
import { HERO_SIZES, ProductMorph, backIfPrevious } from "@/components/product-morph";
import { ProductReviews } from "@/components/product-reviews";

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

export function ProductDetail({ product, related }: { product: ProductDTO; related: ProductDTO[] }) {
  const { t, m, price: fmt, locale } = useI18n();
  const router = useRouter();
  const { addToCart } = useStore();
  const toast = useToast();
  const catLabel = useCategoryLabel(locale, m.categories);
  const [variantId, setVariantId] = useState((product.variants.find((v) => v.inStock) ?? product.variants[0])?.id);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const catName = catLabel(product.category);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const price = variant?.price ?? product.price;
  const compareAt = variant?.compareAt ?? undefined;
  const onSale = compareAt != null && compareAt > price;
  const pct = onSale ? Math.round((1 - price / compareAt!) * 100) : 0;
  const soldOut = !variant?.inStock;
  const maxQty = Math.max(1, variant?.maxQty ?? 1);
  const detail = product.detail;

  /** Adds the current selection; resolves false (after a toast) when it failed. */
  const put = async () => {
    if (!variant || soldOut || busy) return false;
    setBusy(true);
    try {
      await addToCart(variant.id, Math.min(qty, maxQty));
      return true;
    } catch {
      toast(m.common.actionFailed);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    if (await put()) toast(`${product.name} · ${m.product.addedToCart}`);
  };
  const buyNow = async () => {
    if (!(await put())) return;
    // Checkout is no longer a route: land on the cart at its form (below the
    // lines); the cart page turns the #checkout hash into the auto-scroll.
    stampNav(window.location.pathname, "/cart", "nav-forward");
    router.push("/cart#checkout", { transitionTypes: ["nav-forward"] });
  };

  return (
    <NavTransition>
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 md:px-6 md:pt-10 md:pb-24">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label={m.common.breadcrumb}>
        <Link href="/" transitionTypes={["nav-back"]} onClick={(e) => backIfPrevious(e, "/")} className="flex items-center gap-1 transition-colors duration-150 hover:text-foreground">
          <ChevronLeft size={13} className="rtl:rotate-180" /> {m.nav.home}
        </Link>
        <span className="text-faint">/</span>
        <Link
          href={`/products?category=${product.category}`}
          transitionTypes={["nav-back"]}
          onClick={(e) => backIfPrevious(e, `/products?category=${product.category}`)}
          className="transition-colors duration-150 hover:text-foreground"
        >
          {catName}
        </Link>
        <span className="text-faint">/</span>
        <span dir="ltr" className="max-w-40 truncate text-foreground rtl:text-right">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        {/* Imagery */}
        <div className="min-w-0">
          <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-surface">
            <ProductMorph slug={product.slug} variant="hero" className="rounded-[13px]">
              <Image
                src={product.image}
                alt={product.name}
                fill
                priority
                sizes={HERO_SIZES}
                className="object-cover"
              />
            </ProductMorph>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {onSale && <Badge tone="sale"><span dir="ltr">−{pct}%</span></Badge>}
            {product.isNew && <Badge tone="volt">{t("common.new")}</Badge>}
            {product.bestSeller && !product.isNew && <Badge tone="dark">{t("common.bestSeller")}</Badge>}
          </div>
        </div>

        {/* Info + buy box */}
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase rtl:tracking-normal">{catName}</p>
          <h1 dir="ltr" className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] md:text-4xl rtl:text-right rtl:tracking-normal">
            {product.name}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{tr(product.short, locale)}</p>

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
              {m.product.chooseVariant}: <span className="text-foreground">{tr(variant?.label, locale)}</span>
              {soldOut && <span className="ms-2 text-danger">· {m.common.soldOut}</span>}
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
                    onClick={() => {
                      setVariantId(v.id);
                      setQty((q) => Math.min(q, Math.max(1, v.maxQty)));
                    }}
                    className={cn(
                      "h-10 cursor-pointer rounded-full border px-4 text-[13px] font-medium transition-colors duration-150",
                      !v.inStock && "line-through decoration-1 opacity-60",
                      active
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line bg-background text-muted hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {tr(v.label, locale)}
                    {v.priceDelta > 0 && <span dir="ltr" className="num ms-1.5 font-mono text-[11px] opacity-70">+{fmt(v.priceDelta)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* One decision, two clear paths: add to cart OR order this item now */}
          <div className="mt-8 rounded-card border border-line bg-surface/60 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <QtyStepper qty={qty} onChange={setQty} max={maxQty} />
              <Button onClick={add} variant="outline" className="flex-1 gap-2" disabled={soldOut || busy}>
                <ShoppingBag size={16} /> {soldOut ? m.common.soldOut : m.product.addToCart}
              </Button>
            </div>

            <div className="my-3 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint rtl:tracking-normal">{m.product.orDivider}</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button onClick={buyNow} size="lg" className="w-full gap-2" disabled={soldOut || busy}>
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
            { id: "description", title: m.product.descriptionTitle, content: <p>{tr(detail?.description, locale)}</p> },
            {
              id: "specs",
              title: m.product.specsTitle,
              content: (
                <table className="w-full">
                  <tbody className="divide-y divide-line">
                    {(detail?.specs[locale] ?? []).map(([k, v]) => (
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
                  {(detail?.inTheBox[locale] ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            },
            {
              id: "reviews",
              title: `${m.reviews.title} (${product.reviews})`,
              content: <ProductReviews slug={product.slug} />,
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
    </NavTransition>
  );
}
