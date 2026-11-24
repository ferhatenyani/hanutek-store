import { route } from "@/server/lib/http";
import { reviewBulkSchema } from "@/server/validation";
import { bulkModerateReviews } from "@/server/services/admin-content";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const POST = route({ auth: { permission: "reviews:moderate" } }, async (ctx) => {
  const { ids, status } = await ctx.body(reviewBulkSchema);
  const result = await bulkModerateReviews(ids, status, actorOf(ctx));
  invalidateCatalog();
  return result;
});
