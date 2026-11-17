"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultLocale, dirOf, isRTL, LOCALE_KEY, type Locale } from "./config";
import { fr, type Messages } from "./messages/fr";
import { ar } from "./messages/ar";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils";

const dictionaries: Record<Locale, Messages> = { fr, ar };

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
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // Restore persisted choice and reflect lang/dir on <html>.
  useEffect(() => {
    let initial = defaultLocale;
    try {
      const saved = window.localStorage.getItem(LOCALE_KEY);
      if (saved === "fr" || saved === "ar") initial = saved;
    } catch {
      /* private mode */
    }
    setLocaleState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      /* ignore */
    }
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