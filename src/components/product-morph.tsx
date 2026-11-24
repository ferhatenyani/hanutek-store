"use client";

import { ViewTransition, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { flushSync, preload } from "react-dom";
import { getImageProps } from "next/image";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { releaseStampSoon } from "@/components/nav-transition";

/**
 * Product image shared-element transition (card ⇄ detail hero).
 *
 * Technique from nextjs/react-view-transitions-demo: a <ViewTransition> with
 * the SAME `name` on both ends, `share="morph"` + `default="none"`. React
 * pairs the exiting and entering boundaries inside the navigation transition
 * and the browser morphs the image's box from one rect to the other. This
 * works for link clicks AND browser Back/Forward (Next runs history
 * traversals inside startTransition too) because the name isn't gated on a
 * transition type.
 *
 * Unlike the demo, a card only carries the name while it is the morph
 * TARGET. Static names on every card would pair the same product across two
 * listing pages (home rails ⇄ /products, detail related ⇄ detail related)
 * and fly a dozen images around on unrelated navigations. The detail hero is
 * always named; exactly one card per page can match it.
 *
 * The target is set at the START of each navigation, before React commits:
 * - card click → that card's product;
 * - any other link click / JS push (stampNav) → the product of the detail
 *   page being left, so its hero morphs into a card if the destination shows
 *   one (e.g. breadcrumb → Home), otherwise nothing;
 * - Back/Forward → the product being returned to (see popTarget).
 */

let target: string | null = null;
const listeners = new Set<() => void>();

export function setMorphTarget(slug: string | null): void {
  if (slug === target) return;
  target = slug;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getTarget = () => target;
const getServerTarget = () => null;

/* ---------------- slow networks: never morph into an empty box ----------------
 * The detail hero is a different (larger) srcset candidate than the card, so
 * it is only requested once the detail page renders. On a slow connection
 * the morph used to land on a blank frame and the photo popped in later.
 * Two layers of defence:
 * 1. warmHeroImage: on intent (hover / press / focus) the hero's own srcset
 *    is preloaded, so it is usually cached by the time the page commits.
 * 2. rememberCardImage: on click, the card's already-decoded image URL is
 *    kept; the hero paints it as a background under the <Image>, so the new
 *    snapshot always has a picture (zero extra bytes), and the sharp image
 *    simply covers it when it arrives. */

export const HERO_SIZES = "(min-width: 768px) 50vw, 100vw";
const warmed = new Set<string>();

export function warmHeroImage(src: string, hover = false): void {
  if (warmed.has(src)) return;
  // A mouse hover isn't a commitment: respect Data Saver there. A press or
  // keyboard focus on the link is (the image will be needed anyway).
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (hover && conn?.saveData) return;
  warmed.add(src);
  const { props } = getImageProps({ src, alt: "", fill: true, sizes: HERO_SIZES });
  preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high" });
}

let cardImage: { slug: string; src: string } | null = null;
export function rememberCardImage(slug: string, link: HTMLElement): void {
  const img = link.querySelector("img");
  cardImage = img?.complete && img.currentSrc ? { slug, src: img.currentSrc } : null;
}

export function detailSlug(path: string): string | null {
  const m = path.split(/[?#]/)[0].match(/^\/products\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Shared-element boundary around a product image. `variant="card"` gets
 *  its name when it becomes the morph target; `"hero"` is always named. The
 *  wrapper clips to the surface's corner radius so the snapshot morphs from
 *  the card's top-rounded crop into the hero's fully rounded frame. */
export function ProductMorph({
  slug,
  variant,
  className,
  children,
}: {
  slug: string;
  variant: "card" | "hero";
  className?: string;
  children: ReactNode;
}) {
  const active = useSyncExternalStore(subscribe, getTarget, getServerTarget) === slug;
  // Once named, a card keeps its name until it unmounts. React (dev) tracks
  // named boundaries by their CURRENT name and only releases them on unmount;
  // a card un-named while mounted leaks a stale entry and the next card with
  // that name logs a false "two <ViewTransition> with the same name" error.
  // Keeping it is safe: a pair needs the name on BOTH pages, and the
  // incoming page only names the current target.
  const [sticky, setSticky] = useState(false);
  if (active && !sticky) setSticky(true);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const named = !reduceMotion && (variant === "hero" || active || sticky);
  // Hero only: the card image the user just tapped (already in the HTTP
  // cache), frozen at mount. Null on a direct load, so SSR markup matches.
  const [standIn] = useState(() => (variant === "hero" && cardImage?.slug === slug ? cardImage.src : null));
  // The boundary stays mounted either way (only its name changes) so the
  // <Image> never remounts when a card becomes the target.
  return (
    <ViewTransition name={named ? `product-img-${slug}` : undefined} share="morph" default="none">
      <div
        className={cn("absolute inset-0 overflow-hidden", standIn && "bg-cover bg-center", className)}
        style={standIn ? { backgroundImage: `url("${standIn}")` } : undefined}
      >
        {children}
      </div>
    </ViewTransition>
  );
}

/* ---------------- navigation tracking ---------------- */

let committedPath: string | null = null;
let committedIndex: number | null = null;
let committedKey: string | null = null;
let pendingRestore: { key: string; y: number; path: string } | null = null;
const scrollByEntry = new Map<string, number>();
/** Horizontal scrollers (home rails on phones) marked data-scroll-key: their
 *  remounted copy starts at scrollLeft 0, which would leave the card the
 *  user tapped off-screen and the reverse morph with no target. */
const railsByEntry = new Map<string, Record<string, number>>();
const SCROLL_KEY = "hanutek-scroll-v1";

type NavApi = { currentEntry?: { key: string; index: number } | null };
const nav = (): NavApi | undefined => (window as unknown as { navigation?: NavApi }).navigation;
const entryKey = () => nav()?.currentEntry?.key ?? location.href;

/** Back/Forward target: when returning (Back) from a detail page, its hero
 *  morphs into the card it was opened from; when going (Forward) to a
 *  detail page, the destination card on the current page morphs into it. */
function popTarget(from: string, to: string, back: boolean | null): string | null {
  const a = detailSlug(from);
  const b = detailSlug(to);
  if (a && b) return back === false ? b : a;
  return a ?? b;
}

function snapshotRails(key: string | null) {
  if (!key) return;
  const rails: Record<string, number> = {};
  document.querySelectorAll<HTMLElement>("[data-scroll-key]").forEach((el) => {
    if (el.scrollLeft) rails[el.dataset.scrollKey!] = el.scrollLeft;
  });
  railsByEntry.set(key, rails);
}

function onPopState() {
  const to = location.pathname;
  const from = committedPath ?? to;
  const idx = nav()?.currentEntry?.index;
  const back = idx != null && committedIndex != null ? idx < committedIndex : null;
  snapshotRails(committedKey);
  // Commit the new target NOW, in its own sync render, before Next's
  // listener (registered later, in a passive effect) starts the traversal
  // transition: the OLD page's card must already carry its name when the
  // old snapshot is taken (Forward from a listing), and the sync update must
  // never be batched into the transition's render — a Sync+Transition lane
  // mix is not view-transition eligible. (Native popstates are replayed
  // outside the event by the inline script in app/layout.tsx for the same
  // reason.)
  flushSync(() => setMorphTarget(popTarget(from, to, back)));
  // Manual scroll restoration, applied inside the transition's commit (see
  // NavigationTracker) so the NEW snapshot is taken at the restored scroll
  // and the reverse morph lands exactly on the card. The browser's own
  // restoration runs at popstate time, while the old (often shorter) page
  // is still mounted, and gets clamped.
  pendingRestore = { key: entryKey(), y: scrollByEntry.get(entryKey()) ?? 0, path: to };
  if (from === to) {
    // Same-pathname pop (e.g. listing filter history): no route commit to
    // hook into, restore once the new search params have rendered.
    requestAnimationFrame(() => requestAnimationFrame(applyRestore));
  }
}

function applyRestore() {
  if (!pendingRestore) return;
  const rails = railsByEntry.get(pendingRestore.key);
  if (rails) {
    document.querySelectorAll<HTMLElement>("[data-scroll-key]").forEach((el) => {
      const x = rails[el.dataset.scrollKey!];
      if (x) el.scrollLeft = x;
    });
  }
  window.scrollTo({ top: pendingRestore.y, behavior: "instant" });
  pendingRestore = null;
}

function onClickCapture(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.target) return;
  snapshotRails(entryKey()); // still the origin entry: the push hasn't happened yet
  // Default for any link: the current detail product (or nothing). A product
  // card's own onClick runs after this (bubble phase) and overrides it.
  setMorphTarget(detailSlug(location.pathname));
}

type NavEntries = NavApi & { entries?: () => { url: string | null }[] };

/**
 * onClick for "back"-style links (product breadcrumbs). When the link points
 * at exactly the page we came from, go back in history instead of pushing a
 * new entry: the user lands where they were (scroll restored) and the hero
 * morphs back into the card they opened. Otherwise the link navigates as
 * usual (a push, which scrolls to the top). Without the Navigation API the
 * previous entry is unknown, so the link always navigates normally.
 */
export function backIfPrevious(e: React.MouseEvent<HTMLAnchorElement>, href: string): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const n = nav() as NavEntries | undefined;
  const idx = n?.currentEntry?.index;
  if (!n?.entries || idx == null || idx < 1) return;
  const prev = n.entries()[idx - 1]?.url;
  if (!prev) return;
  const p = new URL(prev);
  const t = new URL(href, location.href);
  if (p.origin !== t.origin || p.pathname !== t.pathname || p.search !== t.search) return;
  e.preventDefault();
  history.back();
}

let saveQueued = false;
function onScroll() {
  if (saveQueued) return;
  saveQueued = true;
  requestAnimationFrame(() => {
    saveQueued = false;
    // Between popstate and the commit the entry key already points at the
    // destination while the old page is still on screen — don't record that.
    if (!pendingRestore) scrollByEntry.set(entryKey(), window.scrollY);
  });
}

/** Mounted once in the app shell. */
export function NavigationTracker() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    // In-app Back/Forward restore scroll manually (see onPopState). Reloads
    // and cross-document history loads are left to the browser, which
    // re-applies the position as late layout settles: switch back to "auto"
    // when the document is unloaded and to "manual" once it has loaded.
    let manualTimer = 0;
    const goManual = () => {
      manualTimer = window.setTimeout(() => (history.scrollRestoration = "manual"), 100);
    };
    if (document.readyState === "complete") goManual();
    else window.addEventListener("load", goManual, { once: true });
    // Positions survive a reload so Back after it still lands right.
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "[]") as [string, number][];
      saved.forEach(([k, y]) => {
        if (!scrollByEntry.has(k)) scrollByEntry.set(k, y);
      });
    } catch {
      /* storage unavailable — non-fatal */
    }
    const persist = () => {
      history.scrollRestoration = "auto";
      try {
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify([...scrollByEntry].slice(-50)));
      } catch {
        /* non-fatal */
      }
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) goManual(); // back from bfcache: no load event
    };
    window.addEventListener("pagehide", persist);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearTimeout(manualTimer);
      window.removeEventListener("load", goManual);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Runs inside React's view-transition update callback (layout effects are
  // flushed before the new snapshot is captured), after Next's own scroll
  // handling for pushes.
  useLayoutEffect(() => {
    if (pendingRestore && pendingRestore.path === pathname) applyRestore();
    committedPath = pathname;
    committedKey = entryKey();
    committedIndex = nav()?.currentEntry?.index ?? null;
    // Reading scrollY here would force a synchronous layout of the whole new
    // page inside the view transition's update step (delaying the first
    // animation frame). Record it after paint instead; the scroll listener
    // keeps it current from then on.
    const key = entryKey();
    requestAnimationFrame(() => {
      if (!pendingRestore && entryKey() === key) scrollByEntry.set(key, window.scrollY);
    });
    // Low-end mode (no view transitions): play the incoming page's slide-in
    // on the live element for one beat (see html[data-lite] in globals.css).
    const root = document.documentElement;
    let enterTimer = 0;
    if (root.hasAttribute("data-lite") && root.dataset.nav) {
      root.setAttribute("data-enter", "");
      enterTimer = window.setTimeout(() => root.removeAttribute("data-enter"), 300);
    }
    releaseStampSoon();
    return () => {
      window.clearTimeout(enterTimer);
      root.removeAttribute("data-enter");
    };
  }, [pathname]);

  return null;
}
