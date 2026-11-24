import { route, validate } from "@/server/lib/http";
import { promotionPatchSchema, uuid } from "@/server/validation";
import { deletePromotion, getPromotion, updatePromotion } from "@/server/services/admin-ops";
import { actorOf } from "@/server/lib/route-helpers";

export const GET = route<{ id: string }>({ auth: { permission: "promotions:write" } }, async (ctx) => ({
  promotion: await getPromotion(validate(uuid, ctx.params.id)),
}));

export const PATCH = route<{ id: string }>({ auth: { permission: "promotions:write" } }, async (ctx) => {
  const patch = await ctx.body(promotionPatchSchema);
  return { promotion: await updatePromotion(validate(uuid, ctx.params.id), patch, actorOf(ctx)) };
});

/** Unused codes only (409 otherwise — deactivate instead). */
export const DELETE = route<{ id: string }>({ auth: { permission: "promotions:write" } }, async (ctx) => {
  await deletePromotion(validate(uuid, ctx.params.id), actorOf(ctx));
  return { ok: true };
});
