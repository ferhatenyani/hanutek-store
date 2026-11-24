import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { env, googleEnabled } from "@/server/env";
import { exchangeCode, safeNext } from "@/server/auth/google";
import { verifyState } from "@/server/auth/tokens";
import { safeEqual } from "@/server/lib/crypto";
import { COOKIE, serializeCookie } from "@/server/auth/cookies";
import { loginWithGoogle } from "@/server/services/accounts";
import { adoptGuestCart, meta, setSessionCookies } from "@/server/lib/route-helpers";
import { log } from "@/server/lib/logger";

export const GET = route({ auth: "none", limits: [{ limit: LIMITS.loginIp }] }, async (ctx) => {
  const clearState = () => ctx.setCookie(serializeCookie(COOKIE.oauth, "", { maxAge: 0, path: "/api/v1/auth/google" }));
  const fail = (reason: string) => {
    clearState();
    return new Response(null, { status: 302, headers: { location: `${env().APP_URL}/login?error=${reason}` } });
  };
  if (!googleEnabled()) return fail("google_unavailable");
  const q = ctx.url.searchParams;
  if (q.get("error")) return fail("google_cancelled");
  const code = q.get("code");
  const state = q.get("state");
  const stored = await verifyState(ctx.cookie(COOKIE.oauth) ?? "");
  if (!code || !state || !stored || !safeEqual(stored.state, state)) return fail("google_state");
  try {
    const profile = await exchangeCode(code, stored.verifier, stored.nonce);
    const locale = ctx.req.headers.get("accept-language")?.toLowerCase().startsWith("ar") ? "ar" : "fr";
    const { user, tokens } = await loginWithGoogle({ ...profile, locale }, meta(ctx));
    setSessionCookies(ctx, tokens);
    await adoptGuestCart(ctx, user.id);
    clearState();
    return new Response(null, { status: 302, headers: { location: `${env().APP_URL}${safeNext(stored.next)}` } });
  } catch (err) {
    log.warn("google_login_failed", { err });
    return fail("google_failed");
  }
});
