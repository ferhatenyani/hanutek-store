import { route } from "@/server/lib/http";
import { orderBulkStatusSchema } from "@/server/validation";
import { bulkChangeStatus } from "@/server/services/orders";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

/** Same transition for many orders; each order succeeds or fails on its own (per-order results). */
export const POST = route({ auth: { permission: "orders:write" } }, async (ctx) => {
  const { numbers, status, note, carrier } = await ctx.body(orderBulkStatusSchema);
  const result = await bulkChangeStatus(numbers, status, actorOf(ctx), { note, ...(carrier !== undefined ? { carrier } : {}) });
  if ((status === "cancelled" || status === "returned") && result.updated > 0) invalidateCatalog();
  return result;
});
