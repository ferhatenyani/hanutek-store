import { route, validate } from "@/server/lib/http";
import { slug as slugSchema } from "@/server/validation";
import { setFavorite } from "@/server/services/favorites";

export const PUT = route<{ slug: string }>({ auth: "required" }, async (ctx) => ({
  slugs: await setFavorite(ctx.requireUser().id, validate(slugSchema, ctx.params.slug), true),
}));

export const DELETE = route<{ slug: string }>({ auth: "required" }, async (ctx) => ({
  slugs: await setFavorite(ctx.requireUser().id, validate(slugSchema, ctx.params.slug), false),
}));
