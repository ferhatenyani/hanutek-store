import { route } from "@/server/lib/http";
import { carrierSchema } from "@/server/validation";
import { createCarrier, listCarriers } from "@/server/services/admin-content";
import { actorOf } from "@/server/lib/route-helpers";

/** Readable by anyone who handles orders (the ship dialog lists carriers). */
export const GET = route({ auth: { permission: "orders:read" } }, async () => ({ items: await listCarriers() }));

export const POST = route({ auth: { permission: "settings:manage" } }, async (ctx) => {
  const input = await ctx.body(carrierSchema);
  return Response.json({ carrier: await createCarrier(input, actorOf(ctx)) }, { status: 201 });
});
