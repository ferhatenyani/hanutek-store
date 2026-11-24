import { route, validate } from "@/server/lib/http";
import { customerPatchSchema, uuid } from "@/server/validation";
import { getCustomer, updateCustomer } from "@/server/services/admin-ops";
import { actorOf } from "@/server/lib/route-helpers";

export const GET = route<{ id: string }>({ auth: { permission: "customers:read" } }, async (ctx) => ({
  customer: await getCustomer(validate(uuid, ctx.params.id)),
}));

export const PATCH = route<{ id: string }>({ auth: { permission: "customers:write" } }, async (ctx) => {
  const patch = await ctx.body(customerPatchSchema);
  return { customer: await updateCustomer(validate(uuid, ctx.params.id), patch, actorOf(ctx)) };
});
