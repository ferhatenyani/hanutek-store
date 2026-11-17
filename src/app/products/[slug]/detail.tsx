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
import { categoryBySlug, variantPrice } from "@/lib/products";
import { cn, formatPrice } from "@/lib/utils";
import { useStore, cartTotals } from "@/lib/store";
import { Button, buttonClasses, Badge, QtyStepper } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { TextAnimate } from "@/components/ui/text-animate";
import { Lens } from "@/components/ui/lens";
import { NavTransition, ProductMorph } from "@/components/nav-transition";
import { useToast } from "@/components/ui/toast";

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
              className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[15px] font-medium transition-colors hover:text-accent-ink"
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
  const { addToCart } = useStore();
  const toast = useToast();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(1);
  const checkoutRef = useRef<HTMLAnchorElement>(null);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const price = variantPrice(product, variantId);
  const compareAt = product.compareAt ? product.compareAt + variant.priceDelta : undefined;
  const category = categoryBySlug[product.category];
  const quickTotal = cartTotals([{ productId: product.slug, variantId, qty }]).total;

  const add = () => {
    addToCart(product.slug, variantId, qty);
    toast(`${product.name} added to cart`);
  };

  const buyNow = () => {
    addToCart(product.slug, variantId, qty);
    checkoutRef.current?.click();
  };

  return (
    <NavTransition>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-28 md:px-6 md:pt-10 md:pb-20">
        <BlurFade duration={0.35}>
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/" transitionTypes={["nav-back"]} className="flex items-center gap-1 transition-colors hover:text-foreground">
              <ChevronLeft size={13} /> Home
            </Link>
            <span className="text-faint">/</span>
            <Link
              href={`/products?category=${product.category}`}
              transitionTypes={["nav-back"]}
              className="transition-colors hover:text-foreground"
            >
              {category.name}
            </Link>
            <span className="text-faint">/</span>
            <span className="max-w-40 truncate text-foreground">{product.name}</span>
          </nav>
        </BlurFade>

        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          {/* Imagery */}
          <BlurFade duration={0.5}>
            <Lens
              zoomFactor={1.6}
              lensSize={180}
              ariaLabel={`Zoom image of ${product.name}`}
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
            <p className="mt-3 hidden font-mono text-[11px] text-faint md:block">Hover to zoom · {category.name}</p>
            {product.badge && !(compareAt && product.badge.startsWith("Save")) && (
              <div className="mt-4">
                <Badge tone={product.badge === "New" ? "volt" : product.badge === "Sale" ? "danger" : "dark"}>
                  {product.badge}
                </Badge>
              </div>
            )}
          </BlurFade>

          {/* Info + buy box */}
          <div>
            <BlurFade delay={0.05} duration={0.4}>
              <p className="font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase">{category.name}</p>
            </BlurFade>
            <TextAnimate
              as="h1"
              by="word"
              animation="blurInUp"
              duration={0.4}
              className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl"
            >
              {product.name}
            </TextAnimate>
            <BlurFade delay={0.15} duration={0.4}>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{product.short}</p>
            </BlurFade>

            <BlurFade delay={0.2} duration={0.4}>
              <div className="mt-5 flex items-baseline gap-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={price}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="font-mono text-2xl font-semibold"
                  >
                    {formatPrice(price)}
                  </motion.span>
                </AnimatePresence>
                {compareAt && compareAt > price && (
                  <>
                    <span className="font-mono text-sm text-faint line-through">{formatPrice(compareAt)}</span>
                    <Badge tone="success">Save {formatPrice(compareAt - price)}</Badge>
                  </>
                )}
              </div>
            </BlurFade>

            <BlurFade delay={0.25} duration={0.4}>
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium text-muted">
                  {product.variantTitle}: <span className="text-foreground">{variant.label}</span>
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={product.variantTitle}>
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
                        {v.label}
                        {v.priceDelta > 0 && <span className="ml-1.5 font-mono text-[11px] opacity-70">+{formatPrice(v.priceDelta)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <QtyStepper qty={qty} onChange={setQty} />
                <Button onClick={add} className="flex-1 gap-2">
                  <ShoppingBag size={16} /> Add to cart
                </Button>
              </div>
              <Button onClick={buyNow} variant="dark" size="lg" className="mt-3 w-full gap-2">
                <Zap size={16} /> Buy now
              </Button>
              <Link
                ref={checkoutRef}
                href="/checkout"
                transitionTypes={["nav-forward"]}
                className="hidden"
                aria-hidden
                tabIndex={-1}
              >
                Checkout
              </Link>
            </BlurFade>

            {/* Direct checkout section */}
            <BlurFade delay={0.3} duration={0.4}>
              <div className="mt-6 rounded-card border border-line bg-surface/50 p-5">
                <p className="font-mono text-[10px] tracking-[0.18em] text-faint uppercase">Quick checkout</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="truncate text-muted">
                      {product.name} × {qty}
                    </dt>
                    <dd className="shrink-0 font-mono">{formatPrice(price * qty)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Shipping</dt>
                    <dd className="font-mono">{quickTotal - price * qty === 0 ? "Free" : formatPrice(quickTotal - price * qty)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 font-medium">
                    <dt>Total</dt>
                    <dd className="font-mono">{formatPrice(quickTotal)}</dd>
                  </div>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => toast("Express pay is mocked in this demo")}
                  >
                    <Wallet size={14} /> Express pay
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => toast("PayPal checkout is mocked in this demo")}
                  >
                    <CreditCard size={14} /> PayPal
                  </Button>
                </div>
                <Link
                  href="/checkout"
                  transitionTypes={["nav-forward"]}
                  className={buttonClasses("primary", "md", "mt-2 w-full")}
                  onClick={() => addToCart(product.slug, variantId, qty)}
                >
                  Checkout · {formatPrice(quickTotal)}
                </Link>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-faint">
                  <Lock size={11} /> Mock checkout — no payment is processed
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.35} duration={0.4}>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  { icon: Truck, label: "Free over €50" },
                  { icon: ShieldCheck, label: "2-year warranty" },
                  { icon: RotateCcw, label: "30-day returns" },
                ].map((t) => (
                  <div key={t.label} className="rounded-xl border border-line px-2 py-3">
                    <t.icon size={16} className="mx-auto text-accent-ink" />
                    <p className="mt-1.5 text-[11px] text-muted">{t.label}</p>
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
              {
                id: "description",
                title: "Description",
                content: <p>{product.description}</p>,
              },
              {
                id: "specs",
                title: "Specifications",
                content: (
                  <table className="w-full">
                    <tbody className="divide-y divide-line">
                      {product.specs.map(([k, v]) => (
                        <tr key={k}>
                          <td className="w-40 py-2.5 pr-4 align-top text-xs text-faint">{k}</td>
                          <td className="py-2.5 text-[13px] text-foreground">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ),
              },
              {
                id: "box",
                title: "In the box",
                content: (
                  <ul className="list-disc space-y-1 pl-5">
                    {product.inTheBox.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        </BlurFade>
      </div>

      {/* Mobile sticky buy bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-background/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{variant.label}</p>
            <p className="font-mono text-base font-semibold">{formatPrice(price)}</p>
          </div>
          <Button onClick={add} className="shrink-0 gap-2">
            <ShoppingBag size={15} /> Add to cart
          </Button>
        </div>
      </div>
    </NavTransition>
  );
}