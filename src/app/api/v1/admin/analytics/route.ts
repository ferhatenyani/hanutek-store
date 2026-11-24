import { route } from "@/server/lib/http";
import { can } from "@/server/auth/rbac";
import { analyticsQuery } from "@/server/validation";
import { analytics } from "@/server/services/admin-analytics";

/** The activity feed is audit data: only included for audit:read. */
export const GET = route({ auth: { permission: "orders:read" } }, async (ctx) =>
  analytics(ctx.query(analyticsQuery).days, { includeActivity: can(ctx.requireUser().role, "audit:read") }),
);
