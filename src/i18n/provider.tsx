"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { defaultLocale, dirOf, isRTL, LOCALE_KEY, type Locale } from "./config";
import { fr, type Messages } from "./messages/fr";
import { ar } from "./messages/ar";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils";

const dictionaries: Record<Locale, Messages> = { fr, ar };

// The chosen locale lives in localStorage. Model it as an external store so the
// provider hydrates SSR-safely through useSyncExternalStore (server snapshot =
// defaultLocale) instead of a mount-time setState-in-effect.
const LOCALE_EVENT = "hanutek-locale-change";

function readLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(LOCALE_KEY);
    if (saved === "fr" || saved === "ar") return saved;
  } catch {
    /* private mode */
  }
  return defaultLocale;
}

function getLocaleServerSnapshot(): Locale {
  return defaultLocale;
}

function subscribeLocale(onChange: () => void): () => void {
  window.addEventListener(LOCALE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LOCALE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

type Vars = Record<string, string | number>;

interface I18nValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  isRTL: boolean;
  setLocale: (locale: Locale) => void;
  /** Dot-path lookup with {var} interpolation; falls back to French, then the key. */
  t: (path: string, vars?: Vars) => string;
  /** The full message tree for the active locale (for arrays / product content). */
  m: Messages;
  price: (value: number) => string;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function lookup(tree: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, tree);
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Hydrate the persisted locale SSR-safely: server snapshot is the default
  // locale, client snapshot reads localStorage — no setState-in-effect.
  const locale = useSyncExternalStore(subscribeLocale, readLocale, getLocaleServerSnapshot);

  // Reflect lang/dir on <html>.

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      /* ignore */
    }
    // Notify the external store so every useI18n consumer re-reads the locale.
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }, []);

  const t = useCallback(
    (path: string, vars?: Vars) => {
      const value = lookup(dictionaries[locale], path) ?? lookup(dictionaries.fr, path);
      if (typeof value !== "string") return path;
      return interpolate(value, vars);
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: dirOf(locale),
      isRTL: isRTL(locale),
      setLocale,
      t,
      m: dictionaries[locale],
      price: (v: number) => formatPrice(v, locale),
      date: (iso: string) => formatDate(iso, locale),
      dateTime: (iso: string) => formatDateTime(iso, locale),
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <LocaleProvider>");
  return ctx;
}