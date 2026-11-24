import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { changePasswordSchema } from "@/server/validation";
import { changePassword } from "@/server/services/accounts";
import { meta, setSessionCookies } from "@/server/lib/route-helpers";

export const POST = route({ auth: "required", limits: [{ limit: LIMITS.loginIp }] }, async (ctx) => {
  const user = ctx.requireUser();
  const { currentPassword, newPassword } = await ctx.body(changePasswordSchema);
  const tokens = await changePassword(user.id, currentPassword, newPassword, meta(ctx));
  setSessionCookies(ctx, tokens);
  return { ok: true };
});
