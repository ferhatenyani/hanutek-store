import { z } from "zod";
import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { email, locale } from "@/server/validation";
import { subscribe } from "@/server/services/newsletter";

const schema = z.object({ email, locale: locale.default("fr") });

/** Always 200 for a valid address — does not reveal whether it was already subscribed. */
export const POST = route({ auth: "none", limits: [{ limit: LIMITS.emailSend }] }, async (ctx) => {
  const input = await ctx.body(schema);
  await subscribe(input.email, input.locale);
  return { ok: true };
});
