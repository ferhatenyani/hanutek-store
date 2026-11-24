"use client";

import { ViewTransition } from "react";
import type { ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { detailSlug, setMorphTarget } from "@/components/product-morph";

/**
 * Page transition boundary.
 *
 * One mechanism, three parts:
 * - This boundary tags the PAGE snapshot with the "nav-page" view-transition
 *   class on enter/exit. globals.css animates ::view-transition-*(.nav-page):
 *   the old page fades out fast while the new page slides in from frame 0
 *   (opacity + translate only — compositor-only, no blur/scale/blend layers).
 * - Direction (forward/back, RTL-aware) is stamped on <html> as
 *   --vt-old/--vt-new animation names by the inline script in app/layout.tsx
 *   (link clicks + history pops) or stampNav() (JS router.push sites), and
 *   released by NavigationTracker once the transition has settled. No stamp
 *   => animation-name:none => instant swap (in-page URL state, filters).
 * - Shared product image morph: see product-morph.tsx.
 *
 * Reduced motion keeps the tree identical (no remount on hydration) and
 * simply maps every class to "none", so React never starts a transition.
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
  const cls = reduceMotion ? "none" : "nav-page";
  return (
    <ViewTransition default="none" enter={{ default: cls }} exit={{ default: cls }}>
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
  el.style.setProperty("--vt-old", fwd ? (rtl ? "vt-out-back" : "vt-out-fwd") : rtl ? "vt-out-fwd" : "vt-out-back");
  el.style.setProperty("--vt-new", fwd ? (rtl ? "vt-in-back" : "vt-in-fwd") : rtl ? "vt-in-fwd" : "vt-in-back");
  const w = window as unknown as { __vtStampT?: number; __vtStampId?: number };
  w.__vtStampId = (w.__vtStampId ?? 0) + 1;
  window.clearTimeout(w.__vtStampT);
  // Safety net only (slow network / navigation that never commits); the
  // normal release happens in NavigationTracker after the route commits.
  w.__vtStampT = window.setTimeout(releaseStamp, 10000);
}

/** Clears the direction stamp once no view transition is running. */
export function releaseStamp(): void {
  const el = document.documentElement;
  const w = window as unknown as { __vtStampT?: number };
  window.clearTimeout(w.__vtStampT);
  let busy = false;
  try {
    busy = el.matches(":active-view-transition");
  } catch {
    /* unsupported pseudo-class: fall through and clear */
  }
  if (busy) {
    w.__vtStampT = window.setTimeout(releaseStamp, 200);
    return;
  }
  el.style.removeProperty("--vt-old");
  el.style.removeProperty("--vt-new");
  delete el.dataset.nav;
}

/** Called when a route commits: release the stamp after the animation, but
 *  only if no newer navigation has restamped in the meantime. */
export function releaseStampSoon(): void {
  const id = (window as unknown as { __vtStampId?: number }).__vtStampId;
  window.setTimeout(() => {
    if ((window as unknown as { __vtStampId?: number }).__vtStampId === id) releaseStamp();
  }, 700);
}
