import { route, validate } from "@/server/lib/http";
import { categorySchema, slug } from "@/server/validation";
import { upsertCategory } from "@/server/services/admin-catalog";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const PUT = route<{ slug: string }>({ auth: { permission: "catalog:write" } }, async (ctx) => {
  const input = await ctx.body(categorySchema);
  await upsertCategory(input, actorOf(ctx), validate(slug, ctx.params.slug));
  invalidateCatalog();
  return { ok: true };
});
