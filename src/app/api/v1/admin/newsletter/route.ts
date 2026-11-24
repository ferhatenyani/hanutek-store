import { route } from "@/server/lib/http";
import { subscriberQuery } from "@/server/validation";
import { listSubscribers } from "@/server/services/admin-content";

export const GET = route({ auth: { permission: "customers:read" } }, async (ctx) => listSubscribers(ctx.query(subscriberQuery)));
