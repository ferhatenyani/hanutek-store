import { route, validate } from "@/server/lib/http";
import { reviewModerationSchema, uuid } from "@/server/validation";
import { moderateReview } from "@/server/services/reviews";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const PATCH = route<{ id: string }>({ auth: { permission: "reviews:moderate" } }, async (ctx) => {
  const { status } = await ctx.body(reviewModerationSchema);
  await moderateReview(validate(uuid, ctx.params.id), status, actorOf(ctx));
  invalidateCatalog();
  return { ok: true };
});
