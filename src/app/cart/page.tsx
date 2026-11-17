"use client";

import Link from "next/link";
import Image from "next/image";
import { Banknote, ChevronLeft, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useStore, cartTotals, promoDiscountRate } from "@/lib/store";
import { PROMO_CODE, getProduct, variantPrice } from "@/lib/products";
import { useI18n } from "@/i18n";
import { Button, buttonClasses, QtyStepper } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function CartPage() {
  const { m, price: fmt } = useI18n();
  const { cart, cartCount, setQty, removeItem, promo, applyPromo, removePromo, ready } = useStore();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  const totals = cartTotals(cart, promoDiscountRate(promo));
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
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/products" className="flex items-center gap-1 transition-colors duration-150 hover:text-foreground">
          <ChevronLeft size={13} className="rtl:rotate-180" /> {m.cart.continueShopping}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {m.cart.title}{" "}
        {ready && cartCount > 0 && <span className="num font-mono text-lg font-normal text-faint">({cartCount})</span>}
      </h1>

      {ready && cart.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-muted">
            <ShoppingBag size={26} />
          </span>
          <div>
            <p className="text-lg font-medium">{m.cart.empty}</p>
            <p className="mt-1 text-sm text-muted">{m.cart.emptyBody}</p>
          </div>
          <Link href="/products" className={buttonClasses("dark", "lg")}>
            {m.cart.startShopping}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          <div>
            <ul className="divide-y divide-line border-y border-line">
              {cart.map((item) => {
                const p = getProduct(item.productId);
                if (!p) return null;
                const price = variantPrice(p, item.variantId);
                return (
                  <li key={`${item.productId}-${item.variantId}`} className="flex gap-4 py-5 md:gap-6">
                    <Link
                      href={`/products/${p.slug}`}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface md:h-28 md:w-28"
                    >
                      <Image src={p.image} alt={p.name} fill sizes="112px" className="object-cover" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/products/${p.slug}`}
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
                          className="cursor-pointer text-faint transition-colors duration-150 hover:text-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <QtyStepper qty={item.qty} onChange={(q) => setQty(item.productId, item.variantId, q)} />
                        <span dir="ltr" className="num font-mono text-[15px] font-medium">{fmt(price * item.qty)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-24">
            {/* Promo code — clearly visible, explained */}
            {promo ? (
              <div className="flex items-center justify-between rounded-card border border-volt/60 bg-volt-soft px-4 py-3.5">
                <span className="flex items-center gap-2 text-sm font-medium text-accent-ink">
                  <Tag size={15} aria-hidden />
                  <span className="font-mono font-bold">{promo}</span> · {m.cart.promoApplied} (−10 %)
                </span>
                <button
                  type="button"
                  aria-label={m.cart.remove}
                  onClick={removePromo}
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-white/60 hover:text-foreground"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <form
                onSubmit={submitPromo}
                className="rounded-card border border-line bg-accent-soft/60 p-4"
                aria-label={m.cart.promoTitle}
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Tag size={15} className="text-accent-ink" aria-hidden /> {m.cart.promoTitle}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {m.cart.promoHelp.split("DRIVE10")[0]}
                  <code className="mx-0.5 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent-ink">DRIVE10</code>
                  {m.cart.promoHelp.split("DRIVE10")[1]}
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setCodeError(false);
                    }}
                    placeholder={m.cart.promoPlaceholder}
                    aria-label={m.cart.promoPlaceholder}
                    autoCapitalize="characters"
                    className={cn(
                      "h-11 min-w-0 flex-1 rounded-control border bg-surface px-3.5 font-mono text-sm uppercase text-foreground placeholder:font-sans placeholder:normal-case placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
                      codeError ? "border-danger" : "border-line",
                    )}
                  />
                  <Button type="submit" disabled={!code.trim()} className="shrink-0 px-5">
                    {m.cart.promoApply}
                  </Button>
                </div>
                {codeError && <p className="mt-2 text-xs text-danger">{m.cart.promoInvalid}</p>}
              </form>
            )}

            {/* Summary */}
            <div className="rounded-card border border-line bg-surface p-6 shadow-card">
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
                  <dd dir="ltr" className="num font-mono">{fmt(totals.shipping)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-medium">{m.cart.total}</dt>
                  <dd dir="ltr" className="num font-display text-lg font-semibold">{fmt(totals.total)}</dd>
                </div>
              </dl>
              <Link href="/checkout" className={buttonClasses("primary", "lg", "mt-6 w-full")}>
                {m.cart.checkout}
              </Link>
              <Link href="/products" className={buttonClasses("ghost", "md", "mt-2 w-full")}>
                {m.cart.continueShopping}
              </Link>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-faint">
                <Banknote size={12} aria-hidden /> {m.cart.codBadge}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
