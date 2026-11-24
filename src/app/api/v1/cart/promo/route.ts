import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { promoSchema } from "@/server/validation";
import { applyPromo, removePromo } from "@/server/services/cart";
import { cartOwner, rememberGuestCart } from "@/server/lib/route-helpers";

export const POST = route({ auth: "optional", limits: [{ limit: LIMITS.promo }] }, async (ctx) => {
  const { code } = await ctx.body(promoSchema);
  const { cart, newGuestToken } = await applyPromo(cartOwner(ctx), code);
  rememberGuestCart(ctx, newGuestToken);
  return { cart };
});

export const DELETE = route({ auth: "optional" }, async (ctx) => ({ cart: (await removePromo(cartOwner(ctx))).cart }));
