import { ViewTransition } from "react";
import type { ReactNode } from "react";

const NAV_TYPES = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
} as const;

/**
 * Wraps page content so navigations tagged with transitionTypes
 * slide directionally (forward = left, back = right). Untagged
 * transitions (browser back, refresh) stay instant.
 */
export function NavTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={NAV_TYPES} exit={NAV_TYPES} default="none">
      {children}
    </ViewTransition>
  );
}

/** Shared-element morph pair: same `name` on card image and detail hero. */
export function ProductMorph({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition name={`product-img-${slug}`} share="product-morph" default="none">
      {children}
    </ViewTransition>
  );
}