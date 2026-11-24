import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { refreshBodySchema } from "@/server/validation";
import { rotateRefresh } from "@/server/auth/session";
import { meta } from "@/server/lib/route-helpers";

export const POST = route({ auth: "none", limits: [{ limit: LIMITS.refresh }] }, async (ctx) => {
  const { refreshToken } = await ctx.body(refreshBodySchema);
  const t = await rotateRefresh(refreshToken, meta(ctx));
  return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresIn: t.accessExpiresIn };
});
