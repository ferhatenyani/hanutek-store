import { route, validate } from "@/server/lib/http";
import { carrierPatchSchema, uuid } from "@/server/validation";
import { deleteCarrier, updateCarrier } from "@/server/services/admin-content";
import { actorOf } from "@/server/lib/route-helpers";

export const PATCH = route<{ id: string }>({ auth: { permission: "settings:manage" } }, async (ctx) => {
  const patch = await ctx.body(carrierPatchSchema);
  return { carrier: await updateCarrier(validate(uuid, ctx.params.id), patch, actorOf(ctx)) };
});

export const DELETE = route<{ id: string }>({ auth: { permission: "settings:manage" } }, async (ctx) => {
  await deleteCarrier(validate(uuid, ctx.params.id), actorOf(ctx));
  return { ok: true };
});
