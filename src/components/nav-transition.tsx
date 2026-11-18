"use client";

import { ViewTransition } from "react";
import type { ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Page transition boundary — rebuilt from the two references.
 *
 * - A2 cinematic push (ecommerce-transition-demo.html): each page wraps its
 *   content in this typed ViewTransition boundary; links carry
 *   transitionTypes ["nav-forward"] / ["nav-back"] and the exact push motion
 *   lives in globals.css (::view-transition-*(.nav-*)).
 * - Hardware Back/Forward is handled OUTSIDE React, by the early inline
 *   script in app/layout.tsx: Next 16 only starts a view transition for
 *   typed navigations, so an untyped pop would swap instantly. The script
 *   wins the popstate race (it runs before the router chunk registers its
 *   listener), starts a manual document.startViewTransition around the
 *   router's synchronous commit and stamps <html data-nav="nav-forward|
 *   nav-back"> BEFORE the old snapshot is taken — globals.css then pushes
 *   the root pair with the same cinematic values.
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
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dir = force ?? navTypes(from, to)?.[0];
  if (!dir) return;
  const rtl = document.documentElement.dir === "rtl";
  const fwd = dir === "nav-forward";
  const el = document.documentElement;
  el.style.setProperty("--vt-old", fwd ? (rtl ? "vt-push-out-back" : "vt-push-out-fwd") : rtl ? "vt-push-out-fwd" : "vt-push-out-back");
  el.style.setProperty("--vt-new", fwd ? (rtl ? "vt-push-in-back" : "vt-push-in-fwd") : rtl ? "vt-push-in-fwd" : "vt-push-in-back");
  window.setTimeout(() => {
    el.style.removeProperty("--vt-old");
    el.style.removeProperty("--vt-new");
  }, 900);
}

/**
 * A1 shared image morph (react-view-transitions-demo mechanism): the SAME
 * `name` on a <ViewTransition> on both ends of the pair. The name only
 * applies while the navigation carries the "morph" transition type
 * (share={{ morph: "morph", default: "none" }}), so listing/cart pushes and
 * plain navigations never pick up product-image names. `enabled=false`
 * renders the child bare — for rows that must never claim a name.
 */
export function MorphImage({
  slug,
  enabled = true,
  children,
}: {
  slug: string;
  enabled?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (!enabled || reduceMotion) return <>{children}</>;
  return (
    <ViewTransition
      name={`product-img-${slug}`}
      share={{ morph: "morph", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
