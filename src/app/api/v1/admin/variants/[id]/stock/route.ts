import { route, validate } from "@/server/lib/http";
import { stockAdjustSchema, uuid } from "@/server/validation";
import { adjustStock, listMovements } from "@/server/services/admin-inventory";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const GET = route<{ id: string }>({ auth: { permission: "catalog:read" } }, async (ctx) => ({
  items: (await listMovements({ variantId: validate(uuid, ctx.params.id), pageSize: 50 })).items,
}));

export const POST = route<{ id: string }>({ auth: { permission: "inventory:write" } }, async (ctx) => {
  const input = await ctx.body(stockAdjustSchema);
  const result = await adjustStock(validate(uuid, ctx.params.id), input, actorOf(ctx));
  invalidateCatalog();
  return result;
});
