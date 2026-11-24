import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { registerSchema } from "@/server/validation";
import { register } from "@/server/services/accounts";
import { adoptGuestCart, meta, setSessionCookies } from "@/server/lib/route-helpers";

export const POST = route({ auth: "none", limits: [{ limit: LIMITS.register }] }, async (ctx) => {
  const input = await ctx.body(registerSchema);
  const { user, tokens } = await register(input, meta(ctx));
  setSessionCookies(ctx, tokens);
  await adoptGuestCart(ctx, user.id);
  return Response.json({ user }, { status: 201 });
});
