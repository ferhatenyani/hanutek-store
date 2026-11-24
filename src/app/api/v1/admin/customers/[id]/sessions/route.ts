import { route, validate } from "@/server/lib/http";
import { uuid } from "@/server/validation";
import { revokeCustomerSessions } from "@/server/services/admin-ops";
import { actorOf } from "@/server/lib/route-helpers";

/** Sign the user out on every device. */
export const DELETE = route<{ id: string }>({ auth: { permission: "customers:write" } }, async (ctx) => {
  await revokeCustomerSessions(validate(uuid, ctx.params.id), actorOf(ctx));
  return { ok: true };
});
