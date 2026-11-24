import { route } from "@/server/lib/http";
import { categorySchema } from "@/server/validation";
import { upsertCategory } from "@/server/services/admin-catalog";
import { adminListCategories } from "@/server/services/admin-products";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

/** Every category (including inactive ones) with translations and product counts. */
export const GET = route({ auth: { permission: "catalog:read" } }, async () => ({ items: await adminListCategories() }));

export const POST = route({ auth: { permission: "catalog:write" } }, async (ctx) => {
  const input = await ctx.body(categorySchema);
  await upsertCategory(input, actorOf(ctx));
  invalidateCatalog();
  return Response.json({ ok: true }, { status: 201 });
});
