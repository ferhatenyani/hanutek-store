import { route, validate } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { setQtySchema, uuid } from "@/server/validation";
import { setItemQty } from "@/server/services/cart";
import { cartOwner } from "@/server/lib/route-helpers";

export const PATCH = route<{ variantId: string }>({ auth: "optional", limits: [{ limit: LIMITS.cartWrite }] }, async (ctx) => {
  const { qty } = await ctx.body(setQtySchema);
  return { cart: (await setItemQty(cartOwner(ctx), validate(uuid, ctx.params.variantId), qty)).cart };
});

export const DELETE = route<{ variantId: string }>({ auth: "optional", limits: [{ limit: LIMITS.cartWrite }] }, async (ctx) => ({
  cart: (await setItemQty(cartOwner(ctx), validate(uuid, ctx.params.variantId), 0)).cart,
}));
