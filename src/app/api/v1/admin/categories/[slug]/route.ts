import { route, validate } from "@/server/lib/http";
import { categorySchema, slug } from "@/server/validation";
import { upsertCategory } from "@/server/services/admin-catalog";
import { deleteCategory } from "@/server/services/admin-products";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const PUT = route<{ slug: string }>({ auth: { permission: "catalog:write" } }, async (ctx) => {
  const input = await ctx.body(categorySchema);
  await upsertCategory(input, actorOf(ctx), validate(slug, ctx.params.slug));
  invalidateCatalog();
  return { ok: true };
});

/** Empty categories only (409 otherwise). */
export const DELETE = route<{ slug: string }>({ auth: { permission: "catalog:write" } }, async (ctx) => {
  await deleteCategory(validate(slug, ctx.params.slug), actorOf(ctx));
  invalidateCatalog();
  return { ok: true };
});
