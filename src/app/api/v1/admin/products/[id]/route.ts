import { route, validate } from "@/server/lib/http";
import { productPatchSchema, uuid } from "@/server/validation";
import { adminGetProduct, archiveProduct, updateProduct } from "@/server/services/admin-catalog";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const GET = route<{ id: string }>({ auth: { permission: "catalog:read" } }, async (ctx) => ({
  product: await adminGetProduct(validate(uuid, ctx.params.id)),
}));

export const PATCH = route<{ id: string }>({ auth: { permission: "catalog:write" }, maxBody: 256 * 1024 }, async (ctx) => {
  const patch = await ctx.body(productPatchSchema);
  const product = await updateProduct(validate(uuid, ctx.params.id), patch, actorOf(ctx));
  invalidateCatalog(product.slug);
  return { product };
});

/** Soft delete: archives the product (order history keeps its snapshots). */
export const DELETE = route<{ id: string }>({ auth: { permission: "catalog:write" } }, async (ctx) => {
  await archiveProduct(validate(uuid, ctx.params.id), actorOf(ctx));
  invalidateCatalog();
  return { ok: true };
});
