import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { resetSchema } from "@/server/validation";
import { resetPassword } from "@/server/services/accounts";
import { clearAuthCookies } from "@/server/auth/cookies";

export const POST = route({ auth: "none", limits: [{ limit: LIMITS.passwordReset }] }, async (ctx) => {
  const { token, password } = await ctx.body(resetSchema);
  await resetPassword(token, password);
  for (const c of clearAuthCookies()) ctx.setCookie(c);
  return { ok: true };
});
