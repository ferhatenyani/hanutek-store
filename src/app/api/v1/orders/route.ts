import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { checkoutSchema } from "@/server/validation";
import { placeOrder } from "@/server/services/orders";
import { cartOwner, invalidateCatalog } from "@/server/lib/route-helpers";

/** Checkout (cash on delivery). Idempotent per client-generated key. */
export const POST = route({ auth: "optional", limits: [{ limit: LIMITS.checkout }] }, async (ctx) => {
  const input = await ctx.body(checkoutSchema);
  const result = await placeOrder(cartOwner(ctx), input);
  invalidateCatalog(); // stock changed
  return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
});
