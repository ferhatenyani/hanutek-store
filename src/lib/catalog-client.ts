"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { CategoryDTO, Locale, Localized } from "./api-types";

/** Pick the active locale from a { fr, ar } pair (falls back to French). */
export const tr = (value: Localized | undefined | null, locale: Locale): string => (value ? value[locale] || value.fr : "");

let categoriesPromise: Promise<CategoryDTO[]> | null = null;
let categoriesCache: CategoryDTO[] | null = null;

/** Categories for client chrome (footer, search) — fetched once per page load, HTTP-cached by the API. */
export function useCategories(initial?: CategoryDTO[]): CategoryDTO[] {
  const [list, setList] = useState<CategoryDTO[]>(initial ?? categoriesCache ?? []);
  useEffect(() => {
    if (initial?.length) {
      categoriesCache ??= initial;
      return;
    }
    let alive = true;
    categoriesPromise ??= api<{ items: CategoryDTO[] }>("/categories")
      .then((r) => (categoriesCache = r.items))
      .catch(() => {
        categoriesPromise = null;
        return [];
      });
    void categoriesPromise.then((items) => alive && setList(items));
    return () => {
      alive = false;
    };
  }, [initial]);
  return list;
}

/** Category display name: DB translation when known, else the slug. */
export function categoryName(slug: string, locale: Locale, list: CategoryDTO[], key: "name" | "short" | "tagline" = "name"): string {
  const c = list.find((x) => x.slug === slug);
  return c ? tr(c[key], locale) : slug;
}

const CategoriesContext = createContext<CategoryDTO[]>([]);

/** Loads the category list once for the whole app shell. */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const list = useCategories();
  return createElement(CategoriesContext.Provider, { value: list }, children);
}

export const useCategoryList = () => useContext(CategoriesContext);

/**
 * Category label resolver. Uses the DB translations, falling back to the
 * static i18n copy (`fallback`) while the list loads, then the slug.
 */
export function useCategoryLabel(locale: Locale, fallback?: Record<string, { name: string; short: string; tagline: string }>) {
  const list = useCategoryList();
  return useCallback(
    (slug: string, key: "name" | "short" | "tagline" = "name") => {
      const c = list.find((x) => x.slug === slug);
      if (c) return tr(c[key], locale);
      return fallback?.[slug]?.[key] ?? slug;
    },
    [list, locale, fallback],
  );
}
