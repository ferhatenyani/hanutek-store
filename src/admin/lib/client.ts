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
    throw new ApiError(0, "NETWORK", "Erreur réseau. Vérifiez votre connexion et réessayez.");
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

/**
 * French message for any thrown error. The API speaks English (machine
 * messages for logs and integrations); the console is French-only, so every
 * error is mapped from its code — server text is never shown as-is.
 */
const CODE_MESSAGE: Record<string, string> = {
  NETWORK: "Erreur réseau. Vérifiez votre connexion et réessayez.",
  FORBIDDEN: "Vous n’avez pas l’autorisation d’effectuer cette action.",
  UNAUTHENTICATED: "Votre session a expiré. Reconnectez-vous.",
  AUTH_EXPIRED: "Votre session a expiré. Reconnectez-vous.",
  RATE_LIMITED: "Trop de requêtes. Patientez un instant puis réessayez.",
  NOT_FOUND: "Élément introuvable : il a peut-être été supprimé.",
  CONFLICT: "Conflit : les données ont changé entre-temps. Rechargez la page.",
  INVALID_TRANSITION: "Ce changement de statut n’est pas autorisé pour cette commande.",
  ORDER_NOT_CANCELLABLE: "Cette commande ne peut plus être annulée.",
  OUT_OF_STOCK: "Stock insuffisant.",
  PAYLOAD_TOO_LARGE: "Fichier ou contenu trop volumineux.",
  UNSUPPORTED_MEDIA: "Format de fichier non pris en charge.",
  BAD_REQUEST: "Requête invalide.",
  CSRF: "Requête refusée pour des raisons de sécurité. Rechargez la page.",
  INVALID_CREDENTIALS: "Mot de passe incorrect.",
  ACCOUNT_LOCKED: "Compte temporairement verrouillé après trop de tentatives.",
  ACCOUNT_DISABLED: "Ce compte est désactivé.",
  EMAIL_TAKEN: "Un compte existe déjà avec cet e-mail.",
  PROMO_INVALID: "Ce code promo n’est pas valable.",
  INTERNAL: "Erreur du serveur. Réessayez dans un instant.",
};

/** The server's CONFLICT messages (src/server) → French. */
const CONFLICT_MESSAGE: Record<string, string> = {
  "A carrier with this name already exists": "Un transporteur porte déjà ce nom.",
  "Code already in use": "Ce code est déjà utilisé.",
  "Order is closed": "Cette commande est clôturée : elle ne peut plus être modifiée.",
  "SKU already in use": "Ce SKU est déjà utilisé.",
  "Slug already in use": "Cet identifiant d’URL est déjà utilisé.",
  "This category has sub-categories.": "Cette catégorie contient des sous-catégories.",
  "This code has been used on orders. Deactivate it instead.": "Ce code a déjà servi sur des commandes : désactivez-le plutôt que de le supprimer.",
  "This product was changed by someone else. Reload to see the latest version.": "Ce produit a été modifié par quelqu’un d’autre. Rechargez pour voir la dernière version.",
  "Variant code already used on this product": "Ce code de variante existe déjà sur ce produit.",
  "You cannot disable or demote your own account": "Vous ne pouvez pas désactiver ni rétrograder votre propre compte.",
};

/** Zod/field codes → French. */
const FIELD_ERROR: Record<string, string> = {
  required: "obligatoire",
  too_short: "trop court",
  too_long: "trop long",
  invalid_email: "e-mail invalide",
  invalid_phone: "numéro invalide",
  invalid_code: "code invalide (lettres, chiffres, - et _)",
  invalid_sku: "SKU invalide",
  invalid_slug: "identifiant d’URL invalide (minuscules, chiffres et tirets)",
  reserved_slug: "identifiant d’URL réservé",
  invalid_url: "URL invalide",
  invalid_postcode: "code postal à 5 chiffres",
  invalid_wilaya: "wilaya invalide",
  invalid_id: "identifiant invalide",
  invalid_number: "numéro de commande invalide",
  incorrect: "incorrect",
};

const FIELD_NAME: Record<string, string> = {
  code: "Code",
  sku: "SKU",
  slug: "Identifiant d’URL",
  name: "Nom",
  price: "Prix",
  stock: "Stock",
  value: "Valeur",
  email: "E-mail",
  phone: "Téléphone",
  categorySlug: "Catégorie",
  trackingUrl: "URL de suivi",
  newPassword: "Nouveau mot de passe",
  currentPassword: "Mot de passe actuel",
};

function fieldLabel(path: string) {
  const parts = path.split(".");
  const last = parts.filter((p) => !/^\d+$/.test(p)).at(-1) ?? path;
  return FIELD_NAME[last] ?? last;
}

/** Server field errors (codes such as "invalid_sku") → French, keyed by the same field paths. */
export function frenchFields(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    const msg = FIELD_ERROR[v] ?? (v.startsWith("Too big") ? "trop long" : v.startsWith("Too small") ? "trop court" : "valeur invalide");
    out[k] = msg.charAt(0).toUpperCase() + msg.slice(1);
  }
  return out;
}

export function errorMessage(err: unknown, fallback = "Une erreur est survenue."): string {
  if (err instanceof ApiError) {
    if (err.code === "VALIDATION") {
      const first = err.fields ? Object.entries(err.fields)[0] : undefined;
      if (first) return `Champ invalide : ${fieldLabel(first[0])} (${FIELD_ERROR[first[1]] ?? first[1]})`;
      return "Certains champs sont invalides.";
    }
    if (err.code === "CONFLICT" && CONFLICT_MESSAGE[err.message]) return CONFLICT_MESSAGE[err.message];
    return CODE_MESSAGE[err.code] ?? fallback;
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
