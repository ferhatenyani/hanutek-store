"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Lock, RotateCcw, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore, cartTotals, promoDiscountRate } from "@/lib/store";
import { FREE_SHIPPING_THRESHOLD, PROMO_CODE, getProduct, variantPrice } from "@/lib/products";
import { useI18n } from "@/i18n";
import { Button, buttonClasses, QtyStepper } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { NavTransition } from "@/components/nav-transition";
import { useToast } from "@/components/ui/toast";

export default function CartPage() {
  const { t, m, price: fmt, isRTL } = useI18n();
  const { cart, cartCount, setQty, removeItem, promo, applyPromo, removePromo, ready } = useStore();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  const totals = cartTotals(cart, promoDiscountRate(promo));
  const remaining = FREE_SHIPPING_THRESHOLD - (totals.subtotal - totals.discount);
  const vlabel = (slug: string, id: string) =>
    (m.products[slug as keyof typeof m.products] as { variants: Record<string, string> }).variants[id];

  const submitPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (applyPromo(code)) {
      setCode("");
      setCodeError(false);
      toast(`${PROMO_CODE} · ${m.cart.promoApplied}`);
    } else {
      setCodeError(true);
    }
  };

  return (
    <NavTransition>
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <BlurFade duration={0.4}>
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/products" transitionTypes={["nav-back"]} className="flex items-center gap-1 transition-colors hover:text-foreground">
              <ChevronLeft size={13} className="rtl:rotate-180" /> {m.cart.continueShopping}
            </Link>
          </nav>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {m.cart.title}{" "}
            {ready && cartCount > 0 && <span className="num font-mono text-lg font-normal text-faint">({cartCount})</span>}
          </h1>
        </BlurFade>

        {ready && cart.length === 0 ? (
          <BlurFade delay={0.1} className="flex flex-col items-center gap-5 py-24 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-muted">
              <ShoppingBag size={26} />
            </span>
            <div>
              <p className="text-lg font-medium">{m.cart.empty}</p>
              <p className="mt-1 text-sm text-muted">{m.cart.emptyBody}</p>
            </div>
            <Link href="/products" transitionTypes={["nav-forward"]} className={buttonClasses("dark", "lg")}>
              {m.cart.startShopping}
            </Link>
          </BlurFade>
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
            <div>
              <ul className="divide-y divide-line border-y border-line">
                <AnimatePresence initial={false}>
                  {cart.map((item) => {
                    const p = getProduct(item.productId);
                    if (!p) return null;
                    const price = variantPrice(p, item.variantId);
                    return (
                      <motion.li
                        key={`${item.productId}-${item.variantId}`}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: isRTL ? -32 : 32, height: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="flex gap-4 overflow-hidden py-5 md:gap-6"
                      >
                        <Link
                          href={`/products/${p.slug}`}
                          transitionTypes={["nav-forward"]}
                          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface md:h-28 md:w-28"
                        >
                          <Image src={p.image} alt={p.name} fill sizes="112px" className="object-cover" />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/products/${p.slug}`}
                                transitionTypes={["nav-forward"]}
                                dir="ltr"
                                className="block truncate text-[15px] font-medium hover:underline rtl:text-right"
                              >
                                {p.name}
                              </Link>
                              <p className="mt-0.5 text-xs text-muted">{vlabel(p.slug, item.variantId)}</p>
                              <p className="mt-1 text-xs text-faint">
                                <span dir="ltr" className="num font-mono">{fmt(price)}</span> · {m.cart.each}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label={`${m.cart.remove} ${p.name}`}
                              onClick={() => removeItem(item.productId, item.variantId)}
                              className="cursor-pointer text-faint transition-colors hover:text-danger"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center justify-between pt-3">
                            <QtyStepper qty={item.qty} onChange={(q) => setQty(item.productId, item.variantId, q)} />
                            <span dir="ltr" className="num font-mono text-[15px] font-medium">{fmt(price * item.qty)}</span>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>

              <div className="mt-6">
                {promo ? (
                  <div className="flex items-center justify-between rounded-xl border border-line bg-accent-soft px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-accent-ink">
                      <Tag size={15} />
                      <span className="font-mono font-medium">{promo}</span> · {m.cart.promoApplied}
                    </span>
                    <button
                      type="button"
                      aria-label={m.cart.remove}
                      onClick={removePromo}
                      className="cursor-pointer text-muted transition-colors hover:text-foreground"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitPromo} className="flex max-w-sm gap-2">
                    <input
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setCodeError(false);
                      }}
                      placeholder={m.cart.promoPlaceholder}
                      aria-label={m.cart.promoPlaceholder}
                      className="h-11 min-w-0 flex-1 rounded-full border border-line bg-background px-4 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case placeholder:text-faint focus:border-accent focus:outline-none"
                    />
                    <Button type="submit" variant="outline" disabled={!code.trim()}>
                      {m.cart.promoApply}
                    </Button>
                  </form>
                )}
                {codeError && <p className="mt-2 text-xs text-danger">{m.cart.promoInvalid}</p>}
              </div>
            </div>

            <BlurFade delay={0.15} className="h-fit lg:sticky lg:top-24">
              <div className="rounded-card border border-line bg-surface/50 p-6">
                <h2 className="text-base font-semibold">{m.checkout.orderSummary}</h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">{m.cart.subtotal}</dt>
                    <dd dir="ltr" className="num font-mono">{fmt(totals.subtotal)}</dd>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-accent-ink">
                      <dt>{m.cart.discount} ({promo})</dt>
                      <dd dir="ltr" className="num font-mono">−{fmt(totals.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted">{m.cart.shipping}</dt>
                    <dd dir="ltr" className="num font-mono">{totals.shipping === 0 ? m.product.free : fmt(totals.shipping)}</dd>
                  </div>
                  {remaining > 0 ? (
                    <p className="text-xs text-faint">{t("cart.freeShippingProgress", { amount: fmt(remaining) })}</p>
                  ) : (
                    totals.subtotal > 0 && <p className="text-xs text-accent-ink">{m.cart.freeShippingUnlocked}</p>
                  )}
                  <div className="flex items-baseline justify-between border-t border-line pt-3">
                    <dt className="font-medium">{m.cart.total}</dt>
                    <dd dir="ltr" className="num font-display text-lg font-semibold">{fmt(totals.total)}</dd>
                  </div>
                </dl>
                <Link
                  href="/checkout"
                  transitionTypes={["nav-forward"]}
                  className={buttonClasses("primary", "lg", "mt-6 w-full")}
                >
                  {m.cart.checkout}
                </Link>
                <Link
                  href="/products"
                  transitionTypes={["nav-back"]}
                  className={buttonClasses("ghost", "md", "mt-2 w-full")}
                >
                  {m.cart.continueShopping}
                </Link>
                <div className="mt-5 flex items-center justify-center gap-5 text-[11px] text-faint">
                  <span className="flex items-center gap-1.5">
                    <Lock size={12} /> {m.cart.secureCheckout}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <RotateCcw size={12} /> {m.product.returnsNote}
                  </span>
                </div>
              </div>
            </BlurFade>
          </div>
        )}
      </div>
    </NavTransition>
  );
}
