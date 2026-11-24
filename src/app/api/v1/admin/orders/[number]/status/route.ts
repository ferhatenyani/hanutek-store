import { route } from "@/server/lib/http";
import { statusChangeSchema } from "@/server/validation";
import { changeStatusByStaff } from "@/server/services/orders";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const POST = route<{ number: string }>({ auth: { permission: "orders:write" } }, async (ctx) => {
  const { status, ...extra } = await ctx.body(statusChangeSchema);
  const order = await changeStatusByStaff(ctx.params.number.slice(0, 20), status, actorOf(ctx), extra);
  if (status === "cancelled" || status === "returned") invalidateCatalog(); // stock restored
  return { order };
});
