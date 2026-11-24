import { route } from "@/server/lib/http";
import { categorySchema } from "@/server/validation";
import { listCategories } from "@/server/services/catalog";
import { upsertCategory } from "@/server/services/admin-catalog";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const GET = route({ auth: { permission: "catalog:read" } }, async () => ({ items: await listCategories() }));

export const POST = route({ auth: { permission: "catalog:write" } }, async (ctx) => {
  const input = await ctx.body(categorySchema);
  await upsertCategory(input, actorOf(ctx));
  invalidateCatalog();
  return Response.json({ ok: true }, { status: 201 });
});
