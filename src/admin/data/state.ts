"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Table/filter state lives in the URL (shareable, survives reload, back
 * button works). Updates use history.replaceState, which Next.js syncs into
 * useSearchParams without a server round-trip.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const state = useMemo(() => {
    const out: Record<string, string> = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const v = sp.get(k);
      if (v !== null) out[k] = v;
    }
    return out as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are static per page
  }, [sp]);

  const set = useCallback(
    (patch: Partial<T>, opts: { push?: boolean; keepPage?: boolean } = {}) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "" || v === defaults[k]) next.delete(k);
        else next.set(k, String(v));
      }
      // any filter change returns to the first page
      if (!opts.keepPage && !("page" in patch)) next.delete("page");
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts.push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are static per page
    [pathname],
  );

  const reset = useCallback(() => window.history.replaceState(null, "", pathname), [pathname]);
  const activeCount = Object.keys(defaults).filter((k) => !["page", "pageSize", "sort", "dir", "q", "search"].includes(k) && state[k] !== defaults[k]).length;
  return { state, set, reset, activeCount, search: sp.toString() };
}

/** Debounced value (search boxes). */
export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ------------------------------------------------------------ localStorage-backed prefs

const lsListeners = new Set<() => void>();
const lsSubscribe = (l: () => void) => {
  lsListeners.add(l);
  const onStorage = () => l();
  window.addEventListener("storage", onStorage);
  return () => {
    lsListeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};
const lsCache = new Map<string, { raw: string | null; parsed: unknown }>();

function readLs<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return fallback;
  }
  const hit = lsCache.get(key);
  if (hit && hit.raw === raw) return hit.parsed as T;
  let parsed: T = fallback;
  try {
    parsed = raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    parsed = fallback;
  }
  lsCache.set(key, { raw, parsed });
  return parsed;
}

export function useStoredState<T>(key: string, fallback: T): [T, (v: T) => void] {
  const value = useSyncExternalStore(
    lsSubscribe,
    () => readLs(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (v: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* storage full / disabled */
      }
      for (const l of lsListeners) l();
    },
    [key],
  );
  return [value, set];
}

export interface SavedView {
  id: string;
  name: string;
  query: string;
}

/** Named filter presets per table, stored on this device. */
export function useSavedViews(tableId: string) {
  const [views, setViews] = useStoredState<SavedView[]>(`adm:views:${tableId}`, []);
  return {
    views,
    save: (name: string, query: string) => setViews([...views.filter((v) => v.name !== name), { id: crypto.randomUUID(), name, query }]),
    remove: (id: string) => setViews(views.filter((v) => v.id !== id)),
  };
}
