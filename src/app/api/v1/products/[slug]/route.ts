import { route, json, validate } from "@/server/lib/http";
import { notFound } from "@/server/lib/errors";
import { slug as slugSchema } from "@/server/validation";
import { getProductBySlug, relatedProducts } from "@/server/services/catalog";

export const GET = route<{ slug: string }>({ auth: "none" }, async (ctx) => {
  const product = await getProductBySlug(validate(slugSchema, ctx.params.slug));
  if (!product) throw notFound("Product");
  const related = await relatedProducts(product.id, product.category);
  return json({ product, related }, { headers: { "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600" } });
});
