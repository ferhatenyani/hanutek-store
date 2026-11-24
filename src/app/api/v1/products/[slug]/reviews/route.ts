import { route, validate } from "@/server/lib/http";
import { LIMITS } from "@/server/lib/rate-limit";
import { pageQuery, reviewSchema, slug as slugSchema } from "@/server/validation";
import { createReview, listReviews } from "@/server/services/reviews";
import { invalidateCatalog } from "@/server/lib/route-helpers";

export const GET = route<{ slug: string }>({ auth: "optional" }, async (ctx) => {
  const { page, pageSize } = ctx.query(pageQuery);
  return listReviews(validate(slugSchema, ctx.params.slug), ctx.user?.id ?? null, page, pageSize);
});

export const POST = route<{ slug: string }>({ auth: "required", limits: [{ limit: LIMITS.review, perUser: true }] }, async (ctx) => {
  const slug = validate(slugSchema, ctx.params.slug);
  const input = await ctx.body(reviewSchema);
  await createReview(ctx.requireUser().id, slug, input);
  invalidateCatalog(slug);
  return Response.json(await listReviews(slug, ctx.requireUser().id), { status: 201 });
});
