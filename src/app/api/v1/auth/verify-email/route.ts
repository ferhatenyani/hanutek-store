import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { tokenSchema } from "@/server/validation";
import { verifyEmail } from "@/server/services/accounts";

export const POST = route({ auth: "none", limits: [{ limit: LIMITS.passwordReset }] }, async (ctx) => {
  const { token } = await ctx.body(tokenSchema);
  await verifyEmail(token);
  return { ok: true };
});
