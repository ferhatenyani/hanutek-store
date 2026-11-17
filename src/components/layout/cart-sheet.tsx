"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useStore, cartTotals } from "@/lib/store";
import { FREE_SHIPPING_THRESHOLD, getProduct, variantLabel, variantPrice } from "@/lib/products";
import { formatPrice } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks";
import { Sheet } from "@/components/ui/sheet";
import { Button, buttonClasses, QtyStepper } from "@/components/ui/primitives";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useSheetUI } from "./app-shell";

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, cartCount, setQty, removeItem } = useStore();
  const { closeAll } = useSheetUI();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const totals = cartTotals(cart);
  const remaining = FREE_SHIPPING_THRESHOLD - totals.subtotal;
  const progress = Math.min(100, (totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <Sheet open={open} onClose={onClose} side={isDesktop ? "right" : "bottom"} title={`Cart${cartCount > 0 ? ` (${cartCount})` : ""}`}>
      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-surface text-muted">
            <ShoppingBag size={22} />
          </span>
          <div>
            <p className="font-medium">Your cart is empty</p>
            <p className="mt-1 text-sm text-muted">Road-tested gear is one tap away.</p>
          </div>
          <Link href="/products" transitionTypes={["nav-forward"]} onClick={closeAll} className={buttonClasses("dark", "md")}>
            Browse products
          </Link>
        </div>
      ) : (
        <>
          <div className="border-b border-line px-5 py-3">
            {remaining > 0 ? (
              <p className="text-xs text-muted">
                You&apos;re <span className="font-medium text-foreground">{formatPrice(remaining)}</span> away from free shipping
              </p>
            ) : (
              <p className="text-xs font-medium text-success">Free shipping unlocked</p>
            )}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", damping: 28, stiffness: 220 }}
              />
            </div>
          </div>

          <ul className="flex-1 divide-y divide-line px-5">
            <AnimatePresence initial={false}>
              {cart.map((item) => {
                const p = getProduct(item.productId);
                if (!p) return null;
                const price = variantPrice(p, item.variantId);
                return (
                  <motion.li
                    key={`${item.productId}-${item.variantId}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24, height: 0, marginTop: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex gap-3.5 overflow-hidden py-4"
                  >
                    <Link
                      href={`/products/${p.slug}`}
                      transitionTypes={["nav-forward"]}
                      onClick={closeAll}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-surface"
                    >
                      <Image src={p.image} alt={p.name} fill sizes="64px" className="object-cover" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/products/${p.slug}`}
                          transitionTypes={["nav-forward"]}
                          onClick={closeAll}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <button
                          type="button"
                          aria-label={`Remove ${p.name}`}
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="cursor-pointer text-faint transition-colors hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{variantLabel(p, item.variantId)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <QtyStepper size="sm" qty={item.qty} onChange={(q) => setQty(item.productId, item.variantId, q)} />
                        <span className="font-mono text-sm">{formatPrice(price * item.qty)}</span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          <div className="border-t border-line px-5 py-5">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-mono font-medium">
                €<NumberTicker value={totals.subtotal} decimalPlaces={2} />
              </span>
            </div>
            <p className="mb-4 text-xs text-faint">Shipping calculated at checkout.</p>
            <Link
              href="/checkout"
              transitionTypes={["nav-forward"]}
              onClick={closeAll}
              className={buttonClasses("primary", "lg", "w-full")}
            >
              Checkout · {formatPrice(totals.total)}
            </Link>
            <Link
              href="/cart"
              transitionTypes={["nav-forward"]}
              onClick={closeAll}
              className={buttonClasses("ghost", "md", "mt-2 w-full")}
            >
              View full cart
            </Link>
          </div>
        </>
      )}
    </Sheet>
  );
}