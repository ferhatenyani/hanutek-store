"use client";

import { ViewTransition } from "react";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Directional page transition — exact port of the push in
 * ecommerce-transition-demo.html (440ms quint: old page drifts back 58px /
 * scale .975 / blur 1.5px / opacity .42; new page enters from 90px /
 * scale .965 / blur 2px / opacity 0). Types are attached with
 * `transitionTypes` on next/link (or router.push). Untagged navigations
 * cross-fade quickly; the "morph" type carries the shared-element pair.
 *
 * On every route commit the entering page's [data-reveal] blocks run the
 * reference's staggered reveal (480ms quint, delays 0 / 45 / 85ms on the
 * first three). The reveal starts just before the push snapshot lifts so
 * the snapshot itself never captures hidden content.
 *
 * Under prefers-reduced-motion the ViewTransition boundary is removed
 * entirely so no browser view-transition is started — content swaps
 * instantly instead of leaving a frozen snapshot overlay.
 */
export function NavTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;
    const delays = [0, 45, 85];
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      targets.forEach((t, i) => {
        t.style.animationDelay = `${delays[Math.min(i, 2)]}ms`;
      });
      el.classList.add("vt-entering");
      doneTimer = setTimeout(() => {
        el.classList.remove("vt-entering");
        targets.forEach((t) => (t.style.animationDelay = ""));
      }, 700);
    };
    if (firstRender.current) {
      // Initial load: no snapshot overlay — reveal immediately (the
      // reference runs its reveal on first show too).
      firstRender.current = false;
      start();
    } else {
      // Route change: let the push snapshot capture fully-visible content,
      // then reveal the live DOM underneath just before the overlay lifts.
      startTimer = setTimeout(start, 300);
    }
    return () => {
      clearTimeout(startTimer);
      clearTimeout(doneTimer);
      el.classList.remove("vt-entering");
      targets.forEach((t) => (t.style.animationDelay = ""));
    };
  }, [pathname, reduceMotion]);

  if (reduceMotion) return <>{children}</>;
  return (
    <ViewTransition
      default="none"
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
    >
      <div ref={ref}>{children}</div>
    </ViewTransition>
  );
}

/**
 * Shared-element morph pair: same `name` on the home card image and the
 * detail hero. The name is only applied when the navigation carries the
 * "morph" transition type (share map below) — listing → detail pushes and
 * cart navigations never pick up stray product-image names.
 * `active=false` detaches the name entirely (cart sheet rows).
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
      share={{ morph: "morph", default: "none" }}
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
