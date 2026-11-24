import { route, validate } from "@/server/lib/http";
import { uuid } from "@/server/validation";
import { deleteOwnReview } from "@/server/services/reviews";
import { invalidateCatalog } from "@/server/lib/route-helpers";

export const DELETE = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  await deleteOwnReview(ctx.requireUser().id, validate(uuid, ctx.params.id));
  invalidateCatalog();
  return { ok: true };
});
