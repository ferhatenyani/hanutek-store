import { route } from "@/server/lib/http";
import { favoritesMergeSchema } from "@/server/validation";
import { listFavoriteSlugs, mergeFavorites } from "@/server/services/favorites";

export const GET = route({ auth: "required" }, async (ctx) => ({ slugs: await listFavoriteSlugs(ctx.requireUser().id) }));

/** Merge guest (local) favorites after sign-in. */
export const POST = route({ auth: "required" }, async (ctx) => {
  const { slugs } = await ctx.body(favoritesMergeSchema);
  return { slugs: await mergeFavorites(ctx.requireUser().id, slugs) };
});
