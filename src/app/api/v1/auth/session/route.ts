import { route, parseCookies, resolveUser } from "@/server/lib/http";
import { AppError } from "@/server/lib/errors";
import { COOKIE, clearAuthCookies } from "@/server/auth/cookies";
import { rotateRefresh } from "@/server/auth/session";
import { googleEnabled } from "@/server/env";
import { getUserDTO } from "@/server/services/accounts";
import { getCart } from "@/server/services/cart";
import { listFavoriteSlugs } from "@/server/services/favorites";
import { meta, setSessionCookies } from "@/server/lib/route-helpers";
import type { SessionDTO } from "@/lib/api-types";

/**
 * Session bootstrap: one request on app load returns user, cart and
 * favorites. Lives under /api/v1/auth so it receives the refresh cookie and
 * can transparently rotate an expired access token (session restoration).
 */
export const POST = route({ auth: "none" }, async (ctx) => {
  let userId: string | null = null;
  let expired = false;
  try {
    const u = await resolveUser(ctx.req, parseCookies(ctx.req.headers.get("cookie")), "optional");
    userId = u?.id ?? null;
  } catch (err) {
    if (!(err instanceof AppError && err.code === "AUTH_EXPIRED")) throw err;
    expired = true;
  }

  const raw = ctx.cookie(COOKIE.refresh);
  if (!userId && raw) {
    try {
      const tokens = await rotateRefresh(raw, meta(ctx));
      setSessionCookies(ctx, tokens);
      userId = tokens.userId;
    } catch (err) {
      if (err instanceof AppError && err.code === "REFRESH_RACE") throw err; // client retries
      for (const c of clearAuthCookies()) ctx.setCookie(c);
    }
  } else if (expired) {
    for (const c of clearAuthCookies()) ctx.setCookie(c);
  }

  const user = userId ? await getUserDTO(userId) : null;
  const owner = user ? { userId: user.id } : { guestToken: ctx.cookie(COOKIE.cart) ?? null };
  const [cart, favorites] = await Promise.all([getCart(owner), user ? listFavoriteSlugs(user.id) : Promise.resolve([])]);
  const body: SessionDTO = { user, cart, favorites, features: { google: googleEnabled() } };
  return body;
});
