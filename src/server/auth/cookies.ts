import "server-only";
import { env, isProd } from "../env";

/**
 * Cookie policy
 *  - access token: httpOnly, SameSite=Lax, Path=/, lifetime = token TTL
 *  - refresh token: httpOnly, SameSite=Strict, Path=/api/v1/auth (only sent to auth endpoints)
 *  - guest cart: httpOnly, SameSite=Lax, 30 days
 *  - Secure + __Host-/__Secure- prefixes in production
 */
export const COOKIE = {
  get access() {
    return isProd() ? "__Host-ht_at" : "ht_at";
  },
  get refresh() {
    return isProd() ? "__Secure-ht_rt" : "ht_rt";
  },
  get cart() {
    return isProd() ? "__Host-ht_cart" : "ht_cart";
  },
  get oauth() {
    return isProd() ? "__Secure-ht_oauth" : "ht_oauth";
  },
};

export const REFRESH_PATH = "/api/v1/auth";

interface CookieOpts {
  maxAge: number;
  path?: string;
  sameSite?: "Lax" | "Strict";
  httpOnly?: boolean;
}

export function serializeCookie(name: string, value: string, o: CookieOpts): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? "/"}`, `Max-Age=${Math.max(0, Math.floor(o.maxAge))}`];
  if (o.maxAge <= 0) parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  parts.push(`SameSite=${o.sameSite ?? "Lax"}`);
  if (o.httpOnly !== false) parts.push("HttpOnly");
  if (isProd()) parts.push("Secure");
  return parts.join("; ");
}

export const accessCookie = (token: string) =>
  serializeCookie(COOKIE.access, token, { maxAge: env().ACCESS_TOKEN_TTL_SEC });
export const refreshCookie = (token: string) =>
  serializeCookie(COOKIE.refresh, token, {
    maxAge: env().REFRESH_TOKEN_TTL_DAYS * 86400,
    path: REFRESH_PATH,
    sameSite: "Strict",
  });
export const clearAuthCookies = () => [
  serializeCookie(COOKIE.access, "", { maxAge: 0 }),
  serializeCookie(COOKIE.refresh, "", { maxAge: 0, path: REFRESH_PATH, sameSite: "Strict" }),
];
export const cartCookie = (token: string) => serializeCookie(COOKIE.cart, token, { maxAge: 30 * 86400 });
export const clearCartCookie = () => serializeCookie(COOKIE.cart, "", { maxAge: 0 });
