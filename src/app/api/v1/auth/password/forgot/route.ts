import { route } from "@/server/lib/http";
import { enforce, LIMITS } from "@/server/lib/rate-limit";
import { forgotSchema } from "@/server/validation";
import { requestPasswordReset } from "@/server/services/accounts";

/** Always 200: never reveals whether an account exists. */
export const POST = route({ auth: "none", limits: [{ limit: LIMITS.passwordReset }] }, async (ctx) => {
  const { email } = await ctx.body(forgotSchema);
  await enforce(LIMITS.emailSend, `reset:${email}`);
  await requestPasswordReset(email);
  return { ok: true };
});
