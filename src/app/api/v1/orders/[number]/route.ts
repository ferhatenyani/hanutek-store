import { route } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { orderKeyQuery } from "@/server/validation";
import { getOrderForViewer } from "@/server/services/orders";

export const GET = route<{ number: string }>({ auth: "optional", limits: [{ limit: LIMITS.orderLookup }] }, async (ctx) => {
  const { key } = ctx.query(orderKeyQuery);
  const guestKey = ctx.req.headers.get("x-order-key") ?? key ?? null;
  const order = await getOrderForViewer(ctx.params.number.slice(0, 20), { userId: ctx.user?.id, guestKey });
  return { order };
});
