import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { sendVerificationEmail } from "@/server/services/accounts";

export const POST = route({ auth: "required", limits: [{ limit: LIMITS.emailSend, perUser: true }] }, async (ctx) => {
  const user = ctx.requireUser();
  if (!user.emailVerified) await sendVerificationEmail(user.id);
  return { ok: true };
});
