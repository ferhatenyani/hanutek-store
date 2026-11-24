import { route, validate } from "@/server/lib/http";
import { AppError } from "@/server/lib/errors";
import { LIMITS } from "@/server/lib/rate-limit";
import { imageOrderSchema, uuid } from "@/server/validation";
import { addProductImage, reorderImages } from "@/server/services/admin-catalog";
import { MAX_UPLOAD_BYTES } from "@/server/services/media";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

/** multipart/form-data: file=<image>, alt=<text?>. Converted to WebP renditions server-side. */
export const POST = route<{ id: string }>(
  { auth: { permission: "media:write" }, limits: [{ limit: LIMITS.upload, perUser: true }] },
  async (ctx) => {
    const productId = validate(uuid, ctx.params.id);
    const len = Number(ctx.req.headers.get("content-length") ?? 0);
    if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("PAYLOAD_TOO_LARGE", "Images must be 10 MB or smaller");
    if (!(ctx.req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      throw new AppError("UNSUPPORTED_MEDIA", "Expected multipart/form-data");
    }
    const form = await ctx.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Missing file", { fields: { file: "required" } });
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Images must be 10 MB or smaller");
    const alt = typeof form.get("alt") === "string" ? String(form.get("alt")).slice(0, 200) : null;
    const image = await addProductImage(productId, Buffer.from(await file.arrayBuffer()), alt, actorOf(ctx));
    invalidateCatalog();
    return Response.json({ image }, { status: 201 });
  },
);

export const PUT = route<{ id: string }>({ auth: { permission: "catalog:write" } }, async (ctx) => {
  const { order } = await ctx.body(imageOrderSchema);
  await reorderImages(validate(uuid, ctx.params.id), order, actorOf(ctx));
  invalidateCatalog();
  return { ok: true };
});
