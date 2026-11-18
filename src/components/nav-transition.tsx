"use client";

import { ViewTransition } from "react";
import type { ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Directional page transition — exact port of the push in
 * ecommerce-transition-demo.html (old page drifts back 58px / scale .965 /
 * blur 5px / opacity .42 over 420ms; new page enters from 90px / scale .975 /
 * blur 4px / opacity .55 over 440ms, quint easing). Types are attached with
 * `transitionTypes` on next/link (or router.push). Untagged navigations stay
 * instant. `to-cart` / `to-checkout` carry the dedicated cart & checkout
 * entrances.
 *
 * Under prefers-reduced-motion the ViewTransition boundary is removed entirely
 * so no browser view-transition is started — content swaps instantly instead of
 * leaving a frozen snapshot overlay (which `animation: none` alone can cause).
 */
export function NavTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (reduceMotion) return <>{children}</>;
  return (
    <ViewTransition
      default="none"
      enter={{
        "nav-forward": "nav-in-forward",
        "nav-back": "nav-in-back",
        "to-cart": "cart-page-in",
        "to-checkout": "checkout-in",
        default: "none",
      }}
      exit={{
        "nav-forward": "nav-out-forward",
        "nav-back": "nav-out-back",
        "to-cart": "fade-out",
        "to-checkout": "fade-out",
        default: "none",
      }}
    >
      {children}
    </ViewTransition>
  );
}

/**
 * Shared-element morph pair: same `name` on the card/sheet/cart image and the
 * detail hero. `active=false` detaches the name (used while the cart sheet is
 * open so page images and sheet images never hold duplicate names).
 */
export function ProductMorph({
  slug,
  active = true,
  children,
}: {
  slug: string;
  active?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (reduceMotion) return <>{children}</>;
  return (
    <ViewTransition
      name={active ? `product-img-${slug}` : undefined}
      share="product-morph"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

/** Tab order used to derive forward/back direction between the main pages. */
const TAB_ORDER = ["/", "/products", "/favorites", "/profile"];

function tabIndex(path: string): number {
  const clean = path.split(/[?#]/)[0];
  if (clean === "/") return 0;
  return TAB_ORDER.findIndex(
    (t, i) => i > 0 && (clean === t || clean.startsWith(`${t}/`)),
  );
}

/**
 * Direction types for a navigation between tab pages (Homepage · All Products
 * · Favorites · Profile). Returns undefined for same-tab or non-tab routes so
 * those navigations stay instant unless tagged explicitly.
 */
export function navTypes(from: string, to: string): string[] | undefined {
  const a = tabIndex(from);
  const b = tabIndex(to);
  if (a < 0 || b < 0 || a === b) return undefined;
  return [b > a ? "nav-forward" : "nav-back"];
}
