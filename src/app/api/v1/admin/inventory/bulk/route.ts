import { route } from "@/server/lib/http";
import { stockBulkSchema } from "@/server/validation";
import { bulkAdjustStock } from "@/server/services/admin-inventory";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

/** All-or-nothing stock update for many variants (e.g. after a stock count). */
export const POST = route({ auth: { permission: "inventory:write" } }, async (ctx) => {
  const { items, reason, note } = await ctx.body(stockBulkSchema);
  const result = await bulkAdjustStock(items, { reason, note }, actorOf(ctx));
  invalidateCatalog();
  return result;
});
