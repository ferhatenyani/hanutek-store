import { route } from "@/server/lib/http";
import { movementQuery } from "@/server/validation";
import { listMovements } from "@/server/services/admin-inventory";

export const GET = route({ auth: { permission: "catalog:read" } }, async (ctx) => listMovements(ctx.query(movementQuery)));
