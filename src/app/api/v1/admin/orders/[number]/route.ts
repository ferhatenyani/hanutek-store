import { route } from "@/server/lib/http";
import { orderPatchSchema } from "@/server/validation";
import { adminGetOrder, updateOrderByStaff } from "@/server/services/orders";
import { actorOf } from "@/server/lib/route-helpers";

export const GET = route<{ number: string }>({ auth: { permission: "orders:read" } }, async (ctx) => ({
  order: await adminGetOrder(ctx.params.number.slice(0, 20)),
}));

export const PATCH = route<{ number: string }>({ auth: { permission: "orders:write" } }, async (ctx) => {
  const patch = await ctx.body(orderPatchSchema);
  return { order: await updateOrderByStaff(ctx.params.number.slice(0, 20), actorOf(ctx), patch) };
});
