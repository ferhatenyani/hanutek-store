import { route } from "@/server/lib/http";
import { AppError } from "@/server/lib/errors";
import { LIMITS } from "@/server/lib/rate-limit";
import { COOKIE, clearAuthCookies } from "@/server/auth/cookies";
import { rotateRefresh } from "@/server/auth/session";
import { meta, setSessionCookies } from "@/server/lib/route-helpers";

export const POST = route({ auth: "none", limits: [{ limit: LIMITS.refresh }] }, async (ctx) => {
  const raw = ctx.cookie(COOKIE.refresh);
  if (!raw) throw new AppError("UNAUTHENTICATED", "No session");
  try {
    const tokens = await rotateRefresh(raw, meta(ctx));
    setSessionCookies(ctx, tokens);
    return { ok: true, expiresIn: tokens.accessExpiresIn };
  } catch (err) {
    if (err instanceof AppError && err.code === "UNAUTHENTICATED") for (const c of clearAuthCookies()) ctx.setCookie(c);
    throw err;
  }
});
