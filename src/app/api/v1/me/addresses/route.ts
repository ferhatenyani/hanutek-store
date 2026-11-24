import { route } from "@/server/lib/http";
import { listAddresses } from "@/server/services/accounts";

export const GET = route({ auth: "required" }, async (ctx) => ({ items: await listAddresses(ctx.requireUser().id) }));
