"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Banknote, ChevronLeft, ShoppingBag, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { tr } from "@/lib/catalog-client";
import { useI18n } from "@/i18n";
import { buttonClasses, QtyStepper } from "@/components/ui/primitives";
import { NavTransition } from "@/components/nav-transition";
import { CartPromo } from "@/components/cart-promo";
import { CheckoutForm } from "@/components/checkout-form";

/** Scroll to the checkout form that already lives below the cart lines.
 *  No route change, no remount — the viewport just moves (A3). */
function scrollToCheckout() {
  document.getElementById("checkout")?.scrollIntoView({ block: "start" });
}

export function CartView() {
  const { m, price: fmt, locale } = useI18n();
  const { cart, cartCount, setQty, removeItem, promo, ready } = useStore();
  const pathname = usePathname();
  const totals = cart;

  // /cart#checkout (buy-now, redirected /checkout deep links): auto-scroll to
  // the form once the cart has hydrated and the section actually exists.
  useEffect(() => {
    if (!ready || cart.lines.length === 0) return;
    if (window.location.hash === "#checkout") {
      const raf = requestAnimationFrame(() => {
        document.getElementById("checkout")?.scrollIntoView({ block: "start" });
        history.replaceState(null, "", window.location.pathname + window.location.search);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [ready, cart.lines.length, pathname]);

  return (
    <NavTransition>
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label={m.common.breadcrumb}>
        <Link href="/products" transitionTypes={["nav-back"]} className="flex items-center gap-1 transition-colors duration-150 hover:text-foreground">
          <ChevronLeft size={13} className="rtl:rotate-180" /> {m.cart.continueShopping}
        </Link>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {m.cart.title}{" "}
        {ready && cartCount > 0 && <span className="num font-mono text-lg font-normal text-faint">({cartCount})</span>}
      </h1>

      {!ready ? (
        <div className="mt-8 space-y-4" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-line/40" />
          ))}
        </div>
      ) : cart.lines.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-muted">
            <ShoppingBag size={26} />
          </span>
          <div>
            <p className="text-lg font-medium">{m.cart.empty}</p>
            <p className="mt-1 text-sm text-muted">{m.cart.emptyBody}</p>
          </div>
          <Link href="/products" transitionTypes={["nav-back"]} className={buttonClasses("dark", "lg")}>
            {m.cart.startShopping}
          </Link>
        </div>
      ) : (
        <>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          <div className="min-w-0">
            <ul className="divide-y divide-line border-y border-line">
              {cart.lines.map((item) => {
                const p = { slug: item.slug, name: item.name, image: item.image };
                const price = item.unitPrice;
                return (
                  <li key={item.variantId} className="flex gap-4 py-5 md:gap-6">
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
                          <p className="mt-0.5 text-xs text-muted">{tr(item.variantLabel, locale)}</p>
                          {!item.available && (
                            <p className="mt-0.5 text-xs font-medium text-danger">
                              {item.maxQty > 0 ? m.cart.limitedStock.replace("{n}", String(item.maxQty)) : m.common.soldOut}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-faint">
                            <span dir="ltr" className="num font-mono">{fmt(price)}</span> · {m.cart.each}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`${m.cart.remove} ${p.name}`}
                          onClick={() => removeItem(item.variantId)}
                          className="cursor-pointer text-faint transition-colors duration-150 hover:text-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                        <QtyStepper qty={item.qty} onChange={(q) => setQty(item.variantId, q)} max={Math.max(1, item.maxQty)} />
                        <span dir="ltr" className="num font-mono text-[15px] font-medium">{fmt(item.lineTotal)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
            <CartPromo />

            {/* Summary */}
            <div className="min-w-0 rounded-card border border-line bg-surface p-6 shadow-card">
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
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-medium">{m.cart.total}</dt>
                  <dd dir="ltr" className="num font-display text-lg font-semibold">{fmt(totals.total)}</dd>
                </div>
              </dl>
              <button type="button" onClick={scrollToCheckout} className={buttonClasses("primary", "lg", "mt-6 w-full")}>
                {m.cart.checkout}
              </button>
              <Link href="/products" transitionTypes={["nav-back"]} className={buttonClasses("ghost", "md", "mt-2 w-full")}>
                {m.cart.continueShopping}
              </Link>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-faint">
                <Banknote size={12} aria-hidden /> {m.cart.codBadge}
              </p>
            </div>
          </div>
        </div>

        {/* A3 — the checkout form lives RIGHT HERE, below the cart
            section, always mounted. The summary "Checkout" button above
            only scrolls the viewport down to it; nothing mounts,
            reloads or animates. */}
        <section id="checkout" aria-label={m.checkout.title} className="mt-16 max-w-3xl scroll-mt-28 border-t border-line pt-10">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{m.checkout.title}</h2>
          <CheckoutForm />
        </section>
        </>
      )}
    </div>
    </NavTransition>
  );
}
