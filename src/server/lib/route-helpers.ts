import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { COOKIE, accessCookie, clearCartCookie, refreshCookie, cartCookie } from "../auth/cookies";
import type { IssuedTokens } from "../auth/session";
import { mergeGuestCart, type CartOwner } from "../services/cart";
import type { AuditActor } from "../services/audit";
import type { Ctx } from "./http";
import { log } from "./logger";

export const CATALOG_TAG = "catalog";

export function cartOwner(ctx: Ctx<Record<string, string>>): CartOwner {
  return ctx.user ? { userId: ctx.user.id } : { guestToken: ctx.cookie(COOKIE.cart) ?? null };
}

/** Persist a newly created guest cart's token. */
export function rememberGuestCart(ctx: Ctx<Record<string, string>>, token?: string) {
  if (token) ctx.setCookie(cartCookie(token));
}

export function setSessionCookies(ctx: Ctx<Record<string, string>>, tokens: IssuedTokens) {
  ctx.setCookie(accessCookie(tokens.accessToken));
  ctx.setCookie(refreshCookie(tokens.refreshToken));
}

/** After any successful sign-in: adopt the guest cart, then drop the guest cookie. */
export async function adoptGuestCart(ctx: Ctx<Record<string, string>>, userId: string) {
  const guest = ctx.cookie(COOKIE.cart);
  if (!guest) return;
  await mergeGuestCart(guest, userId).catch((err) => log.error("cart_merge_failed", { err, userId }));
  ctx.setCookie(clearCartCookie());
}

export const meta = (ctx: Ctx<Record<string, string>>) => ({ ip: ctx.ip, userAgent: ctx.userAgent });

export function actorOf(ctx: Ctx<Record<string, string>>): AuditActor & { role: string } {
  const u = ctx.requireUser();
  return { id: u.id, role: u.role, ip: ctx.ip, userAgent: ctx.userAgent };
}

/** Drop cached catalogue pages/data after admin writes (no-op outside a Next request, e.g. tests). */
export function invalidateCatalog(slug?: string) {
  try {
    // { expire: 0 }: prices, stock and availability must never be served stale after a write
    revalidateTag(CATALOG_TAG, { expire: 0 });
    revalidatePath("/");
    revalidatePath("/products");
    if (slug) revalidatePath(`/products/${slug}`);
  } catch {
    /* not inside a Next.js request scope */
  }
}
