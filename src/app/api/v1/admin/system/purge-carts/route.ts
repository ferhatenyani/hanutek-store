import { route } from "@/server/lib/http";
import { purgeCartsSchema } from "@/server/validation";
import { purgeGuestCarts } from "@/server/services/admin-content";
import { actorOf } from "@/server/lib/route-helpers";

export const POST = route({ auth: { permission: "settings:manage" } }, async (ctx) => {
  const { days, dryRun } = await ctx.body(purgeCartsSchema);
  return purgeGuestCarts(days, actorOf(ctx), dryRun);
});
