import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { googleEnabled, env } from "@/server/env";
import { buildAuthorization, safeNext } from "@/server/auth/google";
import { signState } from "@/server/auth/tokens";
import { COOKIE, serializeCookie } from "@/server/auth/cookies";

export const GET = route({ auth: "none", limits: [{ limit: LIMITS.loginIp }] }, async (ctx) => {
  const next = safeNext(ctx.url.searchParams.get("next"));
  if (!googleEnabled()) return new Response(null, { status: 302, headers: { location: `${env().APP_URL}/login?error=google_unavailable` } });
  const auth = buildAuthorization();
  const state = await signState({ state: auth.state, nonce: auth.nonce, verifier: auth.verifier, next });
  // Lax so it survives the top-level redirect back from Google.
  ctx.setCookie(serializeCookie(COOKIE.oauth, state, { maxAge: 600, path: "/api/v1/auth/google", sameSite: "Lax" }));
  return new Response(null, { status: 302, headers: { location: auth.url } });
});
