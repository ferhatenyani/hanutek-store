import { defaultLocale, intlTag, type Locale } from "@/i18n/config";

type ClassValue = string | number | null | undefined | false | Record<string, boolean | null | undefined>;

/** Minimal clsx-style class combiner (no external deps). */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      out.push(String(input));
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) out.push(key);
      }
    }
  }
  return out.join(" ");
}

/** DZD, whole dinars, Western digits, locale-aware symbol (DA / د.ج). */
export function formatPrice(value: number, locale: Locale = defaultLocale): string {
  return new Intl.NumberFormat(intlTag[locale], {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(value);
}

export function formatDate(iso: string, locale: Locale = defaultLocale): string {
  return new Intl.DateTimeFormat(intlTag[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: Locale = defaultLocale): string {
  return new Intl.DateTimeFormat(intlTag[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Whole-number savings percent between a price and its compare-at price. */
export function savingsPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
/** Same-site relative path only (prevents open redirects via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback = "/profile"): string {
  return sameSitePath(next) ?? fallback;
}

/**
 * Returns `next` as a same-origin path, or null. Resolved the way the browser
 * will resolve it — tabs/newlines are stripped and a backslash counts as a
 * slash, so "/<TAB>/evil.com" or "/<BACKSLASH>evil.com" (both → "//evil.com")
 * can't escape the site.
 */
export function sameSitePath(next: string | null | undefined): string | null {
  if (!next || next.length > 300 || !next.startsWith("/")) return null;
  const probe = "https://same-site.invalid";
  let url: URL;
  try {
    url = new URL(next, probe);
  } catch {
    return null;
  }
  if (url.origin !== probe) return null;
  return url.pathname + url.search + url.hash;
}
