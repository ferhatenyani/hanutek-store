import { route } from "@/server/lib/http";
import { enforce, LIMITS } from "@/server/lib/rate-limit";
import { loginSchema } from "@/server/validation";
import { login } from "@/server/services/accounts";
import { adoptGuestCart, meta, setSessionCookies } from "@/server/lib/route-helpers";

export const POST = route({ auth: "none", limits: [{ limit: LIMITS.loginIp }] }, async (ctx) => {
  const input = await ctx.body(loginSchema);
  // Per-account bucket on top of per-IP: slows distributed guessing against one account.
  await enforce(LIMITS.loginEmail, input.email);
  const { user, tokens } = await login(input, meta(ctx));
  setSessionCookies(ctx, tokens);
  await adoptGuestCart(ctx, user.id);
  return { user };
});
