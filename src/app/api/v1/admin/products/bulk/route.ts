import { route } from "@/server/lib/http";
import { productBulkSchema } from "@/server/validation";
import { bulkUpdateProducts } from "@/server/services/admin-products";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const POST = route({ auth: { permission: "catalog:write" } }, async (ctx) => {
  const { ids, patch } = await ctx.body(productBulkSchema);
  const result = await bulkUpdateProducts(ids, patch, actorOf(ctx));
  invalidateCatalog();
  for (const slug of result.slugs) invalidateCatalog(slug);
  return { updated: result.updated };
});
