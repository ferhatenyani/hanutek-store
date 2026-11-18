"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, ShoppingBag, Trash2, X } from "lucide-react";
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
import { ProductMorph } from "@/components/nav-transition";
import { useMediaQuery } from "@/lib/use-media-query";

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, cartCount, promo, setQty, removeItem } = useStore();
  const { m, t, price, isRTL } = useI18n();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Navigating away unmounts the sheet instantly (no exit animation) so the
  // incoming page's view-transition snapshot never holds duplicate product
  // image names — the sheet image morphs into the cart page / detail hero.
  const [skipExit, setSkipExit] = useState(false);
  // Reset the flag when the sheet reopens (adjust state on prop change during
  // render — the React-recommended alternative to a setState-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSkipExit(false);
  }
  const closeForNav = () => {
    // Defer the discrete sheet-close out of the click handler: a synchronous
    // setState here makes Next.js drop the Link's transitionTypes (to-cart /
    // nav-forward), which kills the typed entrance and the shared-element
    // morph. Closing on the next task lets the typed view transition start
    // first; skipExit then unmounts the sheet instantly so the incoming page
    // snapshot holds no duplicate product-image names.
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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side={side}
      title={m.cart.title}
      showTitleBar={false}
      panelClassName={isDesktop ? "w-[420px]!" : "h-[82dvh]!"}
      skipExit={skipExit}
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
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full transition-colors duration-150 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
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

            <div className="flex-1 overflow-y-auto px-5">
              {lines.map(({ product, variantId, qty }) => (
                <div key={variantId} className="flex gap-3 border-b border-line py-4 last:border-0">
                  <Link
                    href={`/products/${product.slug}`}
                    transitionTypes={["nav-forward"]}
                    onClick={closeForNav}
                    className="shrink-0 cursor-pointer"
                  >
                    <ProductMorph slug={product.slug} active={false}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-20 w-20 rounded-xl border border-line object-cover"
                      />
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
              ))}
            </div>

            <div className="space-y-3 border-t border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{m.cart.subtotal}</span>
                <span className="num font-display text-lg font-bold tabular-nums">{price(totals.subtotal)}</span>
              </div>
              <p className="text-xs text-faint">{m.shell.shippingNote}</p>
              <Link
                href="/cart"
                transitionTypes={["to-cart"]}
                onClick={closeForNav}
                className={cn(buttonClasses("primary", "lg"), "w-full")}
              >
                {m.cart.checkout} <ArrowRight size={17} className="rtl:rotate-180" />
              </Link>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
