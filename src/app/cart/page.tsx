"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Lock, RotateCcw, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore, cartTotals, promoDiscountRate } from "@/lib/store";
import { FREE_SHIPPING_THRESHOLD, PROMO_CODE, getProduct, variantLabel, variantPrice } from "@/lib/products";
import { formatPrice } from "@/lib/utils";
import { Button, buttonClasses, QtyStepper } from "@/components/ui/primitives";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import { NavTransition } from "@/components/nav-transition";
import { useToast } from "@/components/ui/toast";

export default function CartPage() {
  const { cart, cartCount, setQty, removeItem, promo, applyPromo, removePromo, ready } = useStore();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  const totals = cartTotals(cart, promoDiscountRate(promo));
  const remaining = FREE_SHIPPING_THRESHOLD - (totals.subtotal - totals.discount);

  const submitPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (applyPromo(code)) {
      setCode("");
      setCodeError(false);
      toast(`${PROMO_CODE} applied — 10% off`);
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
              <ChevronLeft size={13} /> Continue shopping
            </Link>
          </nav>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Your cart{" "}
            {ready && cartCount > 0 && <span className="font-mono text-lg font-normal text-faint">({cartCount})</span>}
          </h1>
        </BlurFade>

        {ready && cart.length === 0 ? (
          <BlurFade delay={0.1} className="flex flex-col items-center gap-5 py-24 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-surface text-muted">
              <ShoppingBag size={26} />
            </span>
            <div>
              <p className="text-lg font-medium">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted">Find something your car will thank you for.</p>
            </div>
            <Link href="/products" transitionTypes={["nav-forward"]} className={buttonClasses("dark", "lg")}>
              Browse products
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
                        exit={{ opacity: 0, x: 32, height: 0 }}
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
                                className="block truncate text-[15px] font-medium hover:underline"
                              >
                                {p.name}
                              </Link>
                              <p className="mt-0.5 text-xs text-muted">{variantLabel(p, item.variantId)}</p>
                              <p className="mt-1 font-mono text-xs text-faint">{formatPrice(price)} each</p>
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove ${p.name}`}
                              onClick={() => removeItem(item.productId, item.variantId)}
                              className="cursor-pointer text-faint transition-colors hover:text-danger"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center justify-between pt-3">
                            <QtyStepper qty={item.qty} onChange={(q) => setQty(item.productId, item.variantId, q)} />
                            <span className="font-mono text-[15px] font-medium">{formatPrice(price * item.qty)}</span>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>

              <div className="mt-6">
                {promo ? (
                  <div className="flex items-center justify-between rounded-xl border border-success/25 bg-success/5 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-success">
                      <Tag size={15} />
                      <span className="font-mono font-medium">{promo}</span> applied — 10% off
                    </span>
                    <button
                      type="button"
                      aria-label="Remove promo code"
                      onClick={removePromo}
                      className="cursor-pointer text-success/70 transition-colors hover:text-success"
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
                      placeholder={`Promo code (try ${PROMO_CODE})`}
                      aria-label="Promo code"
                      className="h-11 min-w-0 flex-1 rounded-full border border-line bg-background px-4 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case placeholder:text-faint focus:border-accent focus:outline-none"
                    />
                    <Button type="submit" variant="outline" disabled={!code.trim()}>
                      Apply
                    </Button>
                  </form>
                )}
                {codeError && <p className="mt-2 text-xs text-danger">That code isn&apos;t valid. Try {PROMO_CODE}.</p>}
              </div>
            </div>

            <BlurFade delay={0.15} className="h-fit lg:sticky lg:top-24">
              <div className="rounded-card border border-line bg-surface/50 p-6">
                <h2 className="text-base font-semibold">Order summary</h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Subtotal</dt>
                    <dd className="font-mono">{formatPrice(totals.subtotal)}</dd>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-success">
                      <dt>Discount ({promo})</dt>
                      <dd className="font-mono">−{formatPrice(totals.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted">Shipping</dt>
                    <dd className="font-mono">{totals.shipping === 0 ? "Free" : formatPrice(totals.shipping)}</dd>
                  </div>
                  {remaining > 0 && (
                    <p className="text-xs text-faint">
                      Add {formatPrice(remaining)} more for free shipping.
                    </p>
                  )}
                  <div className="flex items-baseline justify-between border-t border-line pt-3">
                    <dt className="font-medium">Total</dt>
                    <dd className="font-mono text-lg font-semibold">
                      €<NumberTicker value={totals.total} decimalPlaces={2} />
                    </dd>
                  </div>
                </dl>
                <Link
                  href="/checkout"
                  transitionTypes={["nav-forward"]}
                  className={buttonClasses("primary", "lg", "mt-6 w-full")}
                >
                  Proceed to checkout
                </Link>
                <Link
                  href="/products"
                  transitionTypes={["nav-back"]}
                  className={buttonClasses("ghost", "md", "mt-2 w-full")}
                >
                  Continue shopping
                </Link>
                <div className="mt-5 flex items-center justify-center gap-5 text-[11px] text-faint">
                  <span className="flex items-center gap-1.5">
                    <Lock size={12} /> Secure checkout
                  </span>
                  <span className="flex items-center gap-1.5">
                    <RotateCcw size={12} /> 30-day returns
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