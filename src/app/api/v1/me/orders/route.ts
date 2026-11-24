import { route } from "@/server/lib/http";
import { pageQuery } from "@/server/validation";
import { listUserOrders } from "@/server/services/orders";

export const GET = route({ auth: "required" }, async (ctx) => {
  const { page, pageSize } = ctx.query(pageQuery);
  return listUserOrders(ctx.requireUser().id, page, Math.max(pageSize, 20));
});
