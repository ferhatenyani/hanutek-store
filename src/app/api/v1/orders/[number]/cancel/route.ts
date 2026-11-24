import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { cancelByCustomer } from "@/server/services/orders";
import { invalidateCatalog } from "@/server/lib/route-helpers";

export const POST = route<{ number: string }>({ auth: "optional", limits: [{ limit: LIMITS.orderLookup }] }, async (ctx) => {
  const guestKey = ctx.req.headers.get("x-order-key");
  const order = await cancelByCustomer(ctx.params.number.slice(0, 20), { userId: ctx.user?.id, guestKey });
  invalidateCatalog(); // stock restored
  return { order };
});
