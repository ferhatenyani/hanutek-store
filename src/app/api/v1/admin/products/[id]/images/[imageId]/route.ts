import { route, validate } from "@/server/lib/http";
import { uuid } from "@/server/validation";
import { removeProductImage } from "@/server/services/admin-catalog";
import { actorOf, invalidateCatalog } from "@/server/lib/route-helpers";

export const DELETE = route<{ id: string; imageId: string }>({ auth: { permission: "media:write" } }, async (ctx) => {
  await removeProductImage(validate(uuid, ctx.params.id), validate(uuid, ctx.params.imageId), actorOf(ctx));
  invalidateCatalog();
  return { ok: true };
});
