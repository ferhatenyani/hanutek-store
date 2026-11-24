import { route } from "@/server/lib/http";
import { adminProductQuery, productSchema } from "@/server/validation";
import { adminListProducts, createProduct } from "@/server/services/admin-catalog";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const GET = route({ auth: { permission: "catalog:read" } }, async (ctx) => adminListProducts(ctx.query(adminProductQuery)));

export const POST = route({ auth: { permission: "catalog:write" }, maxBody: 256 * 1024 }, async (ctx) => {
  const input = await ctx.body(productSchema);
  const product = await createProduct(input, actorOf(ctx));
  invalidateCatalog(product.slug);
  return Response.json({ product }, { status: 201 });
});
