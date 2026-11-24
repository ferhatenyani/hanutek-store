"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Positions a layer next to an anchor with `position: fixed`, rendered in a
 * portal so it is never clipped by scroll containers (tables, dialogs).
 * Flips above the anchor when there is not enough room below, clamps to the
 * viewport horizontally and follows scroll/resize.
 */
export function useFloating(anchor: RefObject<HTMLElement | null>, open: boolean, opts: { align?: "start" | "end"; offset?: number; matchWidth?: boolean } = {}) {
  const { align = "start", offset = 6, matchWidth = false } = opts;
  const layer = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", top: -9999, left: -9999, visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
    const a = anchor.current;
    const l = layer.current;
    if (!a || !l) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const lw = matchWidth ? Math.max(r.width, l.offsetWidth) : l.offsetWidth;
    const lh = l.offsetHeight;
    const below = vh - r.bottom - offset - 8;
    const above = r.top - offset - 8;
    const placeAbove = lh > below && above > below;
    const maxHeight = Math.max(160, placeAbove ? above : below);
    let left = align === "end" ? r.right - lw : r.left;
    left = Math.min(Math.max(8, left), vw - lw - 8);
    const top = placeAbove ? Math.max(8, r.top - offset - Math.min(lh, maxHeight)) : r.bottom + offset;
    setStyle({ position: "fixed", top, left, minWidth: matchWidth ? r.width : undefined, maxHeight, zIndex: 80, visibility: "visible" });
    };
    update();
    const id = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchor, align, offset, matchWidth]);

  return { layer, style };
}

export function Portal({ children }: { children: ReactNode }) {
  // Overlays only open after user interaction (client-side), so the host is resolved at render time.
  if (typeof document === "undefined") return null;
  // Render inside the console root so the admin theme variables apply.
  const host = document.querySelector<HTMLElement>(".adm") ?? document.body;
  return createPortal(children, host);
}

/*
 * Layer stack: only the top-most open layer (menu, select, popover, dialog,
 * drawer) reacts to Escape / outside clicks, so closing a select inside a
 * dialog never closes the dialog too.
 */
const layerStack: number[] = [];
let layerSeq = 0;

export function useLayer(open: boolean) {
  const id = useRef(0);
  useEffect(() => {
    if (!open) return;
    const mine = ++layerSeq;
    id.current = mine;
    layerStack.push(mine);
    return () => {
      const i = layerStack.lastIndexOf(mine);
      if (i >= 0) layerStack.splice(i, 1);
    };
  }, [open]);
  return useCallback(() => layerStack.length > 0 && layerStack[layerStack.length - 1] === id.current, []);
}

/** Closes on outside pointer-down and Escape (top-most layer only). */
export function useDismiss(open: boolean, close: () => void, refs: RefObject<HTMLElement | null>[]) {
  const isTop = useLayer(open);
  const closeRef = useRef(close);
  const refsRef = useRef(refs);
  useEffect(() => {
    closeRef.current = close;
    refsRef.current = refs;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!isTop()) return;
      if (refsRef.current.some((r) => r.current?.contains(e.target as Node))) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTop()) {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isTop]);
}
