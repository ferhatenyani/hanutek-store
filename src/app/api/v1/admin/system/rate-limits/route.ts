import { route } from "@/server/lib/http";
import { clearExpiredRateLimits } from "@/server/services/admin-content";
import { actorOf } from "@/server/lib/route-helpers";

/** Housekeeping: drop expired rate-limit buckets. */
export const POST = route({ auth: { permission: "settings:manage" } }, async (ctx) => clearExpiredRateLimits(actorOf(ctx)));
