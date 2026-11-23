"use client";

import { ViewTransition } from "react";
import type { ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { detailSlug, setMorphTarget } from "@/components/product-morph";

/**
 * Page transition boundary — rebuilt from the two references.
 *
 * - A2 cinematic push (ecommerce-transition-demo.html): each page wraps its
 *   content in this typed ViewTransition boundary; links carry
 *   transitionTypes ["nav-forward"] / ["nav-back"] and the exact push motion
 *   lives in globals.css (::view-transition-*(.nav-*)).
 * - Hardware Back/Forward: Next runs history traversals inside
 *   startTransition, so React starts the view transition itself (the
 *   product image morph pairs on pops too). The early inline script in
 *   app/layout.tsx only stamps the push direction (--vt-old/--vt-new) on
 *   <html> before the old snapshot is taken.
 * - Shared product image: see product-morph.tsx.
 * - Reduced motion: the boundary is removed entirely (a CSS-only kill can
 *   leave a stuck snapshot overlay); navigations then swap instantly. The
 *   inline pop script bails on prefers-reduced-motion as well.
 */

/** Tab order used to derive forward/back; anything else (cart, order, auth,
 *  not-found) counts as "deeper" so general navigation still pushes. */
const TABS = ["/", "/products", "/favorites", "/profile"];

function tabIndex(path: string): number {
  const clean = path.split(/[?#]/)[0];
  if (clean === "/") return 0;
  const i = TABS.findIndex((t, k) => k > 0 && (clean === t || clean.startsWith(`${t}/`)));
  return i >= 0 ? i : TABS.length;
}

/** Direction types for a navigation. Undefined when both paths sit at the
 *  same depth (in-page URL state) — those stay untyped/instant. */
export function navTypes(from: string, to: string): string[] | undefined {
  const a = tabIndex(from);
  const b = tabIndex(to);
  if (a === b) return undefined;
  return [b > a ? "nav-forward" : "nav-back"];
}

export function NavTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (reduceMotion) return <>{children}</>;

  // This 19.3 build snapshots ViewTransition boundaries by NAME only, and a
  // named page boundary captures blank mid-flight under the App Router —
  // so the PAGE push is driven on the root pair instead: the inline pop
  // script (layout.tsx) stamps <html data-nav> on history pops AND typed
  // link clicks (capture phase, before the router starts its own transition
  // which — with transitionTypes — still runs a view transition whose root
  // snapshots cover the whole viewport). globals.css animates
  // :root[data-nav]::view-transition-*(root). This boundary keeps the typed
  // navigation "typed" so React starts the transition; its class maps are
  // belt-and-braces for builds where nameless boundaries do snapshot.
  return (
    <ViewTransition
      default="none"
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
    >
      {children}
    </ViewTransition>
  );
}

/**
 * Stamp the push direction for JS-driven navigations (router.push sites
 * without an anchor click): writes the same --vt-old/--vt-new animation
 * name keys as the inline script in layout.tsx, RTL included. No-ops under
 * reduced motion; cleared by a timer once the transition has settled.
 */
export function stampNav(from: string, to: string, force?: "nav-forward" | "nav-back"): void {
  if (typeof document === "undefined" || from === to) return;
  // Same rule as a plain link click: only the leaving detail hero may morph.
  setMorphTarget(detailSlug(from));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dir = force ?? navTypes(from, to)?.[0];
  if (!dir) return;
  const rtl = document.documentElement.dir === "rtl";
  const fwd = dir === "nav-forward";
  const el = document.documentElement;
  el.style.setProperty("--vt-old", fwd ? (rtl ? "vt-push-out-back" : "vt-push-out-fwd") : rtl ? "vt-push-out-fwd" : "vt-push-out-back");
  el.style.setProperty("--vt-new", fwd ? (rtl ? "vt-push-in-back" : "vt-push-in-fwd") : rtl ? "vt-push-in-fwd" : "vt-push-in-back");
  // Shared with the inline script: a newer stamp must not be wiped by the
  // previous navigation's clean-up timer.
  const w = window as unknown as { __vtStampT?: number };
  window.clearTimeout(w.__vtStampT);
  w.__vtStampT = window.setTimeout(() => {
    el.style.removeProperty("--vt-old");
    el.style.removeProperty("--vt-new");
  }, 900);
}
