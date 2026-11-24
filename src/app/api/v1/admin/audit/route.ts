import { route } from "@/server/lib/http";
import { auditQuery } from "@/server/validation";
import { listAudit } from "@/server/services/admin-ops";

export const GET = route({ auth: { permission: "audit:read" } }, async (ctx) => listAudit(ctx.query(auditQuery)));
