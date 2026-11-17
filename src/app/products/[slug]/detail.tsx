"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import type { Product } from "@/lib/products";
import { productsInCategory, variantPrice } from "@/lib/products";
import { cn } from "@/lib/utils";
import { useStore, cartTotals } from "@/lib/store";
import { useI18n } from "@/i18n";
import { Button, buttonClasses, Badge, QtyStepper, SectionHead } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { TextAnimate } from "@/components/ui/text-animate";
import { Lens } from "@/components/ui/lens";
import { NavTransition, ProductMorph } from "@/components/nav-transition";
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
              className="flex w-full cursor-pointer items-center justify-between py-4 text-start text-[15px] font-medium transition-colors hover:text-accent-ink"
            >
              {item.title}
              <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                <ChevronDown size={16} className="text-muted" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
  const { addToCart } = useStore();
  const toast = useToast();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(1);
  const checkoutRef = useRef<HTMLAnchorElement>(null);

  const mp = m.products[product.slug as keyof typeof m.products] as ProductMsg;
  const catName = m.categories[product.category as keyof typeof m.categories].name;
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const price = variantPrice(product, variantId);
  const compareAt = product.compareAt ? product.compareAt + variant.priceDelta : undefined;
  const onSale = compareAt != null && compareAt > price;
  const pct = onSale ? Math.round((1 - price / compareAt!) * 100) : 0;
  const quickTotal = cartTotals([{ productId: product.slug, variantId, qty }]).total;
  const shipping = quickTotal - price * qty;
  const related = productsInCategory(product.category).filter((p) => p.slug !== product.slug).slice(0, 4);

  const add = () => {
    addToCart(product.slug, variantId, qty);
    toast(`${product.name} · ${m.product.addedToCart}`);
  };
  const buyNow = () => {
    addToCart(product.slug, variantId, qty);
    checkoutRef.current?.click();
  };

  return (
    <NavTransition>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-36 md:px-6 md:pt-10 md:pb-20">
        <BlurFade duration={0.35}>
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/" transitionTypes={["nav-back"]} className="flex items-center gap-1 transition-colors hover:text-foreground">
              <ChevronLeft size={13} className="rtl:rotate-180" /> {m.nav.home}
            </Link>
            <span className="text-faint">/</span>
            <Link
              href={`/products?category=${product.category}`}
              transitionTypes={["nav-back"]}
              className="transition-colors hover:text-foreground"
            >
              {catName}
            </Link>
            <span className="text-faint">/</span>
            <span dir="ltr" className="max-w-40 truncate text-foreground rtl:text-right">{product.name}</span>
          </nav>
        </BlurFade>

        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          {/* Imagery */}
          <BlurFade duration={0.5}>
            <Lens
              zoomFactor={1.6}
              lensSize={180}
              ariaLabel={`${m.product.hoverZoom} · ${product.name}`}
              className="overflow-hidden rounded-card border border-line bg-surface"
            >
              <div className="relative aspect-square">
                <ProductMorph slug={product.slug}>
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    priority
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </ProductMorph>
              </div>
            </Lens>
            <p className="mt-3 hidden font-mono text-[11px] text-faint md:block">
              {m.product.hoverZoom} · {catName}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {onSale && (
                <Badge tone="sale"><span dir="ltr">−{pct}%</span></Badge>
              )}
              {product.isNew && <Badge tone="volt">{t("common.new")}</Badge>}
              {product.bestSeller && !product.isNew && <Badge tone="dark">{t("common.bestSeller")}</Badge>}
            </div>
          </BlurFade>

          {/* Info + buy box */}
          <div>
            <BlurFade delay={0.05} duration={0.4}>
              <p className="font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase rtl:tracking-normal">{catName}</p>
            </BlurFade>
            <div dir="ltr" className="rtl:text-right">
              <TextAnimate
                as="h1"
                by="word"
                animation="blurInUp"
                duration={0.4}
                className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl"
              >
                {product.name}
              </TextAnimate>
            </div>
            <BlurFade delay={0.15} duration={0.4}>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{mp.short}</p>
            </BlurFade>

            <BlurFade delay={0.2} duration={0.4}>
              <div className="mt-5 flex flex-wrap items-baseline gap-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={price}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    dir="ltr"
                    className="num font-display text-2xl font-semibold"
                  >
                    {fmt(price)}
                  </motion.span>
                </AnimatePresence>
                {onSale && (
                  <>
                    <span dir="ltr" className="num font-mono text-sm text-faint line-through">{fmt(compareAt!)}</span>
                    <Badge tone="sale">{t("product.save", { amount: fmt(compareAt! - price) })}</Badge>
                  </>
                )}
              </div>
            </BlurFade>

            <BlurFade delay={0.25} duration={0.4}>
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
                          "h-10 cursor-pointer rounded-full border px-4 text-[13px] font-medium transition-all duration-200",
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

              <div className="mt-6 flex gap-3">
                <QtyStepper qty={qty} onChange={setQty} />
                <Button onClick={add} className="flex-1 gap-2">
                  <ShoppingBag size={16} /> {m.product.addToCart}
                </Button>
              </div>
              <Button onClick={buyNow} variant="dark" size="lg" className="mt-3 w-full gap-2">
                <Zap size={16} /> {m.product.buyNow}
              </Button>
              <Link
                ref={checkoutRef}
                href="/checkout"
                transitionTypes={["nav-forward"]}
                className="hidden"
                aria-hidden
                tabIndex={-1}
              >
                {m.cart.checkout}
              </Link>
            </BlurFade>

            {/* Direct checkout section */}
            <BlurFade delay={0.3} duration={0.4}>
              <div className="mt-6 rounded-card border border-line bg-surface/50 p-5">
                <p className="font-mono text-[10px] tracking-[0.18em] text-faint uppercase rtl:tracking-normal">{m.product.quickCheckout}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="truncate text-muted">
                      <span dir="ltr">{product.name}</span> × {qty}
                    </dt>
                    <dd dir="ltr" className="num shrink-0 font-mono">{fmt(price * qty)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">{m.cart.shipping}</dt>
                    <dd dir="ltr" className="num font-mono">{shipping === 0 ? m.product.free : fmt(shipping)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 font-medium">
                    <dt>{m.cart.total}</dt>
                    <dd dir="ltr" className="num font-mono">{fmt(quickTotal)}</dd>
                  </div>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => toast(m.product.mockNote)}
                  >
                    <Wallet size={14} /> {m.product.expressCod}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => toast(m.product.mockNote)}
                  >
                    <CreditCard size={14} /> {m.product.expressCard}
                  </Button>
                </div>
                <Link
                  href="/checkout"
                  transitionTypes={["nav-forward"]}
                  className={buttonClasses("primary", "md", "mt-2 w-full")}
                  onClick={() => addToCart(product.slug, variantId, qty)}
                >
                  {m.cart.checkout} · <span dir="ltr" className="num">{fmt(quickTotal)}</span>
                </Link>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-faint">
                  <Lock size={11} /> {m.product.mockNote}
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.35} duration={0.4}>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  { icon: Truck, label: m.product.freeShippingNote },
                  { icon: ShieldCheck, label: m.product.warrantyNote },
                  { icon: RotateCcw, label: m.product.returnsNote },
                ].map((tr) => (
                  <div key={tr.label} className="rounded-xl border border-line px-2 py-3">
                    <tr.icon size={16} className="mx-auto text-accent-ink" />
                    <p className="mt-1.5 text-[11px] leading-snug text-muted">{tr.label}</p>
                  </div>
                ))}
              </div>
            </BlurFade>
          </div>
        </div>

        {/* Details */}
        <BlurFade inView className="mt-14 max-w-3xl">
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
        </BlurFade>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <BlurFade inView>
              <SectionHead eyebrow={catName} title={m.product.relatedTitle} />
            </BlurFade>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-5">
              {related.map((p, i) => (
                <ProductCard key={p.slug} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky buy bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-background/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{mp.variants[variantId]}</p>
            <p dir="ltr" className="num font-display text-base font-semibold rtl:text-right">{fmt(price)}</p>
          </div>
          <Button onClick={add} className="shrink-0 gap-2">
            <ShoppingBag size={15} /> {m.product.addToCart}
          </Button>
        </div>
      </div>
    </NavTransition>
  );
}
