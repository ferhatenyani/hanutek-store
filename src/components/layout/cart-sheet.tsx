"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { useStore, cartTotals, promoDiscountRate } from "@/lib/store";
import { useI18n } from "@/i18n";
import {
  FREE_SHIPPING_THRESHOLD,
  getProduct,
  variantPrice,
  variantLabel,
  type Product,
} from "@/lib/products";
import { cn } from "@/lib/utils";
import { buttonClasses, QtyStepper } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/use-media-query";

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, cartCount, promo, setQty, removeItem } = useStore();
  const { m, t, price, isRTL } = useI18n();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const lines = cart.flatMap((i) => {
    const product = getProduct(i.productId);
    return product ? [{ product, variantId: i.variantId, qty: i.qty }] : [];
  });
  const totals = cartTotals(cart, promoDiscountRate(promo));
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - totals.subtotal);
  const progress = Math.min(100, (totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const vLabel = (p: Product, id: string) =>
    (m.products as Record<string, { variants?: Record<string, string> }>)[p.slug]?.variants?.[id] ??
    variantLabel(p, id);

  const side = isDesktop ? (isRTL ? "left" : "right") : "bottom";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side={side}
      title={m.cart.title}
      showTitleBar={false}
      panelClassName={isDesktop ? "w-[420px]!" : "h-[82dvh]!"}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold">
            {m.cart.title}{" "}
            {cartCount > 0 && (
              <span className="text-sm font-normal text-muted">
                · {t("cart.items", { n: cartCount })}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label={m.common.close}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
          >
            <X size={18} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent-ink">
              <ShoppingBag size={26} />
            </span>
            <p className="font-display text-lg font-semibold">{m.cart.empty}</p>
            <p className="max-w-[240px] text-sm text-muted">{m.cart.emptyBody}</p>
            <Link href="/products" onClick={onClose} className={cn(buttonClasses("primary", "lg"), "mt-2")}>
              {m.cart.startShopping}
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-line bg-surface/60 px-5 py-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                {remaining === 0 && <Truck size={14} className="text-success" />}
                {remaining > 0
                  ? t("cart.freeShippingProgress", { amount: price(remaining) })
                  : m.cart.freeShippingUnlocked}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-volt transition-all duration-500 ease-out-quint"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              {lines.map(({ product, variantId, qty }) => (
                <div key={variantId} className="flex gap-3 border-b border-line py-4 last:border-0">
                  <Link href={`/products/${product.slug}`} onClick={onClose} className="shrink-0 cursor-pointer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-20 w-20 rounded-xl border border-line object-cover"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${product.slug}`}
                        onClick={onClose}
                        className="cursor-pointer text-sm font-semibold leading-snug hover:text-accent"
                      >
                        {product.name}
                      </Link>
                      <button
                        onClick={() => removeItem(product.slug, variantId)}
                        aria-label={t("cart.remove", { name: product.name })}
                        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{vLabel(product, variantId)}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QtyStepper qty={qty} onChange={(n) => setQty(product.slug, variantId, n)} max={10} />
                      <span className="text-sm font-bold tabular-nums">
                        {price(variantPrice(product, variantId) * qty)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{m.cart.subtotal}</span>
                <span className="font-display text-lg font-bold tabular-nums">{price(totals.subtotal)}</span>
              </div>
              <p className="text-xs text-faint">{m.shell.shippingNote}</p>
              <Link href="/checkout" onClick={onClose} className={cn(buttonClasses("primary", "lg"), "w-full")}>
                {m.cart.checkout} <ArrowRight size={17} className="rtl:rotate-180" />
              </Link>
              <Link
                href="/cart"
                onClick={onClose}
                className="block cursor-pointer text-center text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {m.shell.viewFullCart}
              </Link>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
