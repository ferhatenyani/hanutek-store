import { route } from "@/server/lib/http";
import { enforce, LIMITS } from "@/server/lib/rate-limit";
import { loginSchema } from "@/server/validation";
import { login } from "@/server/services/accounts";
import { meta } from "@/server/lib/route-helpers";

/**
 * Token grant for non-browser / server-side clients (the future admin app's
 * backend). Returns tokens in the body; send them as `Authorization: Bearer`.
 * Never use this from browser JavaScript: browsers use the cookie flow.
 */
export const POST = route({ auth: "none", limits: [{ limit: LIMITS.loginIp }] }, async (ctx) => {
  const input = await ctx.body(loginSchema);
  await enforce(LIMITS.loginEmail, input.email);
  const { user, tokens } = await login(input, meta(ctx));
  return { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.accessExpiresIn };
});
