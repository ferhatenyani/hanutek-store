import { route } from "@/server/lib/http";
import { COOKIE, clearAuthCookies } from "@/server/auth/cookies";
import { revokeByRawToken, revokeFamily } from "@/server/auth/session";

export const POST = route({ auth: "optional" }, async (ctx) => {
  const raw = ctx.cookie(COOKIE.refresh);
  if (raw) await revokeByRawToken(raw);
  else if (ctx.user) await revokeFamily(ctx.user.sessionFamily);
  for (const c of clearAuthCookies()) ctx.setCookie(c);
  return { ok: true };
});
