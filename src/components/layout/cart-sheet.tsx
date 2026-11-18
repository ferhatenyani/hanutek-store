"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Banknote, ChevronLeft, ChevronUp, ShoppingBag, Trash2, X } from "lucide-react";
import { useStore, cartTotals, promoDiscountRate } from "@/lib/store";
import { useI18n } from "@/i18n";
import {
  getProduct,
  variantPrice,
  variantLabel,
  type Product,
} from "@/lib/products";
import { cn } from "@/lib/utils";
import { buttonClasses, QtyStepper } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { CartPromo } from "@/components/cart-promo";
import { ProductMorph } from "@/components/nav-transition";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Cart preview sheet.
 * - Desktop (≥1024px): right-side preview; the CTA navigates to the full
 *   cart page with the cinematic route push.
 * - Mobile + tablet (<1024px): bottom sheet that slides up as a compact
 *   preview and expands IN PLACE to a full-screen cart (same components,
 *   same state). A top "Back" CTA collapses it to the preview; close/swipe
 *   dismisses it. No separate cart page is used on these breakpoints.
 */
export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, cartCount, promo, setQty, removeItem } = useStore();
  const { m, t, price, isRTL } = useI18n();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Expanded (full-screen) state only applies to the bottom sheet. It lives
  // here — not in the store — so expanding/collapsing never remounts the
  // sheet or loses scroll/quantity state.
  const [expanded, setExpanded] = useState(false);

  // Navigating away unmounts the sheet instantly (no exit animation) so the
  // incoming page's view-transition snapshot never holds duplicate product
  // image names.
  const [skipExit, setSkipExit] = useState(false);
  // Reset flags when the sheet reopens (adjust state on prop change during
  // render — the React-recommended alternative to a setState-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSkipExit(false);
      setExpanded(false);
    }
  }
  const closeForNav = () => {
    // Defer the discrete sheet-close out of the click handler: a synchronous
    // setState here makes Next.js drop the Link's transitionTypes, which
    // kills the typed entrance. Closing on the next task lets the typed view
    // transition start first; skipExit then unmounts the sheet instantly so
    // the incoming page snapshot holds no duplicate product-image names.
    setTimeout(() => {
      setSkipExit(true);
      onClose();
    }, 0);
  };

  const lines = cart.flatMap((i) => {
    const product = getProduct(i.productId);
    return product ? [{ product, variantId: i.variantId, qty: i.qty }] : [];
  });
  const totals = cartTotals(cart, promoDiscountRate(promo));

  const vLabel = (p: Product, id: string) =>
    (m.products as Record<string, { variants?: Record<string, string> }>)[p.slug]?.variants?.[id] ??
    variantLabel(p, id);

  const side = isDesktop ? (isRTL ? "left" : "right") : "bottom";
  const fullScreen = expanded && !isDesktop;
  const collapse = () => setExpanded(false);

  const lineRow = ({ product, variantId, qty }: { product: Product; variantId: string; qty: number }) => (
    <div key={variantId} className="flex gap-3 border-b border-line py-4 last:border-0">
      <Link
        href={`/products/${product.slug}`}
        transitionTypes={["nav-forward"]}
        onClick={closeForNav}
        className="shrink-0 cursor-pointer"
      >
        <ProductMorph slug={product.slug} active={false}>
          <span className="relative block h-20 w-20 overflow-hidden rounded-xl border border-line">
            <Image src={product.image} alt={product.name} fill sizes="80px" className="object-cover" />
          </span>
        </ProductMorph>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/products/${product.slug}`}
            transitionTypes={["nav-forward"]}
            onClick={closeForNav}
            className="cursor-pointer text-sm font-semibold leading-snug hover:text-accent"
          >
            {product.name}
          </Link>
          <button
            onClick={() => removeItem(product.slug, variantId)}
            aria-label={`${m.cart.remove} ${product.name}`}
            className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-faint transition-colors duration-150 hover:bg-sale-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            <Trash2 size={15} />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-muted">{vLabel(product, variantId)}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <QtyStepper qty={qty} onChange={(n) => setQty(product.slug, variantId, n)} max={10} />
          <span className="num text-sm font-bold tabular-nums">
            {price(variantPrice(product, variantId) * qty)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side={side}
      title={m.cart.title}
      showTitleBar={false}
      panelClassName={isDesktop ? "w-[420px]!" : fullScreen ? "max-h-dvh! rounded-none!" : undefined}
      panelHeight={isDesktop ? undefined : fullScreen ? "100dvh" : "82dvh"}
      hideHandle={fullScreen}
      onSwipeDismiss={fullScreen ? collapse : onClose}
      onBackdropClick={fullScreen ? collapse : onClose}
      skipExit={skipExit}
    >
      <div className="flex h-full flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line px-3 py-3">
          <div className="justify-self-start">
            {fullScreen && (
              <button
                onClick={collapse}
                className="flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-accent-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <ChevronLeft size={16} className="rtl:-scale-x-100" aria-hidden />
                {m.common.back}
              </button>
            )}
          </div>
          <h2 className="text-center font-display text-lg font-bold">
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
            className="grid h-9 w-9 cursor-pointer place-items-center justify-self-end rounded-full transition-colors duration-150 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
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
            <Link
              href="/products"
              transitionTypes={["nav-forward"]}
              onClick={closeForNav}
              className={cn(buttonClasses("primary", "lg"), "mt-2")}
            >
              {m.cart.startShopping}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 border-b border-line bg-accent-soft/50 px-5 py-3 text-xs font-medium text-accent-ink">
              <Banknote size={14} aria-hidden />
              {m.cart.codBadge}
            </div>

            <div className="flex-1 overflow-y-auto px-5">{lines.map(lineRow)}</div>

            {fullScreen ? (
              <div className="space-y-3 border-t border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <CartPromo />
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">{m.cart.subtotal}</dt>
                    <dd className="num font-semibold tabular-nums">{price(totals.subtotal)}</dd>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex items-center justify-between text-accent-ink">
                      <dt>{m.cart.discount} ({promo})</dt>
                      <dd className="num font-semibold tabular-nums">−{price(totals.discount)}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">{m.cart.shipping}</dt>
                    <dd className="num font-semibold tabular-nums">{price(totals.shipping)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-line pt-2">
                    <dt className="font-medium">{m.cart.total}</dt>
                    <dd className="num font-display text-lg font-bold tabular-nums">{price(totals.total)}</dd>
                  </div>
                </dl>
                <Link
                  href="/checkout"
                  transitionTypes={["nav-forward"]}
                  onClick={closeForNav}
                  className={cn(buttonClasses("primary", "lg"), "w-full")}
                >
                  {m.cart.checkout} <ArrowRight size={17} className="rtl:rotate-180" />
                </Link>
                <Link
                  href="/products"
                  transitionTypes={["nav-back"]}
                  onClick={closeForNav}
                  className={cn(buttonClasses("ghost", "md"), "w-full")}
                >
                  {m.cart.continueShopping}
                </Link>
              </div>
            ) : (
              <div className="space-y-3 border-t border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">{m.cart.subtotal}</span>
                  <span className="num font-display text-lg font-bold tabular-nums">{price(totals.subtotal)}</span>
                </div>
                <p className="text-xs text-faint">{m.shell.shippingNote}</p>
                {isDesktop ? (
                  <Link
                    href="/cart"
                    transitionTypes={["nav-forward"]}
                    onClick={closeForNav}
                    className={cn(buttonClasses("primary", "lg"), "w-full")}
                  >
                    {m.shell.viewFullCart} <ArrowRight size={17} className="rtl:rotate-180" />
                  </Link>
                ) : (
                  <button
                    onClick={() => setExpanded(true)}
                    className={cn(buttonClasses("primary", "lg"), "w-full")}
                  >
                    {m.shell.viewFullCart} <ChevronUp size={17} aria-hidden />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
