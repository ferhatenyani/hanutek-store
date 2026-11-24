import { route } from "@/server/lib/http";
import { promotionSchema } from "@/server/validation";
import { createPromotion, listPromotions } from "@/server/services/admin-ops";
import { actorOf } from "@/server/lib/route-helpers";

export const GET = route({ auth: { permission: "promotions:write" } }, async () => ({ items: await listPromotions() }));

export const POST = route({ auth: { permission: "promotions:write" } }, async (ctx) => {
  const input = await ctx.body(promotionSchema);
  return Response.json({ promotion: await createPromotion(input, actorOf(ctx)) }, { status: 201 });
});
