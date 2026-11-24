"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ApiError, refreshOnce } from "@/lib/api";

/**
 * Admin API client.
 *  - same-origin cookies (httpOnly); the server enforces every permission
 *  - an expired or vanished access cookie triggers one shared refresh, then a retry
 *  - a definitively lost session redirects to /admin/login (keeping the current path)
 */
export { ApiError };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface Opts {
  method?: Method;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  /** Do not redirect to the login page on 401 (login screen, session probe). */
  noRedirect?: boolean;
}

export const SESSION_EXPIRED = "admin:session-expired";

function goToLogin() {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/admin/login")) return;
  const next = window.location.pathname + window.location.search;
  window.dispatchEvent(new Event(SESSION_EXPIRED));
  window.location.assign(`/admin/login?next=${encodeURIComponent(next)}&expired=1`);
}

export async function adminApi<T>(path: string, opts: Opts = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { method: opts.method ?? "GET", headers, body, credentials: "same-origin", signal: opts.signal, cache: "no-store" });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", "Network error. Check your connection and try again.");
  }
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") ?? "";
    return (ct.includes("application/json") ? await res.json() : await res.text()) as T;
  }
  let payload: { error?: { code?: string; message?: string; fields?: Record<string, string>; reason?: string } } = {};
  try {
    payload = await res.json();
  } catch {
    /* non-JSON */
  }
  const code = payload.error?.code ?? `HTTP_${res.status}`;
  if (!retried && (code === "AUTH_EXPIRED" || code === "REFRESH_RACE" || code === "UNAUTHENTICATED")) {
    if (await refreshOnce()) return adminApi<T>(path, opts, true);
    if (!opts.noRedirect) goToLogin();
  } else if (retried && code === "UNAUTHENTICATED" && !opts.noRedirect) {
    goToLogin();
  }
  throw new ApiError(res.status, code, payload.error?.message ?? res.statusText, payload.error?.fields, payload.error?.reason);
}

/** Human message for any thrown error. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) {
    if (err.code === "FORBIDDEN") return "You don't have permission to do that.";
    if (err.code === "RATE_LIMITED") return "Too many requests. Wait a moment and try again.";
    if (err.code === "VALIDATION" && err.fields) {
      const first = Object.entries(err.fields)[0];
      if (first) return `${err.message}: ${first[0]} (${first[1]})`;
    }
    return err.message || fallback;
  }
  return fallback;
}

// ------------------------------------------------------------ query cache

interface Entry {
  data?: unknown;
  error?: unknown;
  promise?: Promise<void>;
  at: number;
  version: number;
}

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let generation = 0;
const emit = () => {
  generation++;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function load(key: string, force = false) {
  const prev = cache.get(key);
  if (prev?.promise && !force) return prev.promise;
  const entry: Entry = { ...(prev ?? { at: 0, version: 0 }), version: (prev?.version ?? 0) + 1 };
  const version = entry.version;
  entry.promise = adminApi<unknown>(key)
    .then((data) => {
      const cur = cache.get(key);
      if (cur?.version !== version) return;
      cache.set(key, { data, at: Date.now(), version });
      emit();
    })
    .catch((error) => {
      const cur = cache.get(key);
      if (cur?.version !== version) return;
      cache.set(key, { data: cur.data, error, at: Date.now(), version });
      emit();
    });
  cache.set(key, entry);
  emit();
  return entry.promise;
}

/**
 * Revalidate every cached query whose path starts with one of the prefixes
 * (e.g. "/admin/orders" after a status change). Mounted queries refetch
 * immediately; others are marked stale.
 */
export function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) {
      const e = cache.get(key)!;
      cache.set(key, { ...e, at: 0 });
      if (mounted.get(key)) void load(key, true);
    }
  }
  emit();
}

const mounted = new Map<string, number>();
const STALE_MS = 20_000;

export interface Query<T> {
  data: T | undefined;
  error: unknown;
  /** first load without any data to show */
  loading: boolean;
  /** a request is in flight (data may be from the previous key) */
  fetching: boolean;
  /** data belongs to a previous key (filters changed, new page loading) */
  stale: boolean;
  reload: () => Promise<void>;
}

/**
 * Cached GET with stale-while-revalidate and "keep previous data" while a
 * new key loads (tables don't flash empty when paging or filtering).
 * Pass null to skip.
 */
export function useApi<T>(key: string | null): Query<T> {
  useSyncExternalStore(subscribe, () => generation, () => generation);
  // previous key's data, kept while a new key loads ("storing information from previous renders")
  const [prev, setPrev] = useState<{ key: string; data: unknown } | null>(null);

  useEffect(() => {
    if (!key) return;
    mounted.set(key, (mounted.get(key) ?? 0) + 1);
    const e = cache.get(key);
    if (!e || (!e.promise && Date.now() - e.at > STALE_MS) || e.at === 0) void load(key, Boolean(e && !e.promise));
    const onFocus = () => {
      const cur = cache.get(key);
      if (cur && Date.now() - cur.at > STALE_MS) void load(key, true);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      const n = (mounted.get(key) ?? 1) - 1;
      if (n <= 0) mounted.delete(key);
      else mounted.set(key, n);
    };
  }, [key]);

  const reload = useCallback(() => (key ? load(key, true) : Promise.resolve()), [key]);
  const entry = key ? cache.get(key) : undefined;
  const has = entry !== undefined && "data" in entry && entry.data !== undefined;
  if (key && has && (prev?.key !== key || prev.data !== entry!.data)) setPrev({ key, data: entry!.data });
  const fallback = !has && prev ? prev.data : undefined;
  return {
    data: (has ? entry!.data : fallback) as T | undefined,
    error: entry?.error,
    loading: Boolean(key) && !has && fallback === undefined && !entry?.error,
    fetching: Boolean(entry?.promise),
    stale: !has && fallback !== undefined,
    reload,
  };
}

/** Builds "/path?a=1&b=2" skipping empty values. */
export function withQuery(path: string, params: Record<string, string | number | undefined | null | false>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** Mutation helper with pending state. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async (...args: A) => {
      setPending(true);
      try {
        return await fn(...args);
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending };
}
