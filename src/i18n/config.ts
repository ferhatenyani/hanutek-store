export const locales = ["fr", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const dirOf = (locale: Locale): "rtl" | "ltr" => (locale === "ar" ? "rtl" : "ltr");
export const isRTL = (locale: Locale): boolean => locale === "ar";

/** Endonym shown in the language switcher. */
export const localeLabel: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
};

/** BCP-47 tag used for Intl formatting (DZ market, Western digits). */
export const intlTag: Record<Locale, string> = {
  fr: "fr-DZ",
  ar: "ar-DZ",
};

export const LOCALE_KEY = "hanutek-locale";