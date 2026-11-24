import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { addItemSchema } from "@/server/validation";
import { addItem } from "@/server/services/cart";
import { cartOwner, rememberGuestCart } from "@/server/lib/route-helpers";

export const POST = route({ auth: "optional", limits: [{ limit: LIMITS.cartWrite }] }, async (ctx) => {
  const { variantId, qty } = await ctx.body(addItemSchema);
  const { cart, newGuestToken } = await addItem(cartOwner(ctx), variantId, qty);
  rememberGuestCart(ctx, newGuestToken);
  return { cart };
});
