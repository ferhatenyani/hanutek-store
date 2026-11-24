import { route, validate } from "@/server/lib/http";
import { promotionPatchSchema, uuid } from "@/server/validation";
import { updatePromotion } from "@/server/services/admin-ops";
import { actorOf } from "@/server/lib/route-helpers";

export const PATCH = route<{ id: string }>({ auth: { permission: "promotions:write" } }, async (ctx) => {
  const patch = await ctx.body(promotionPatchSchema);
  return { promotion: await updatePromotion(validate(uuid, ctx.params.id), patch, actorOf(ctx)) };
});
