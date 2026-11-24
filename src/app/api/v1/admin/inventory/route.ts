import { route } from "@/server/lib/http";
import { inventoryQuery } from "@/server/validation";
import { adminListInventory } from "@/server/services/admin-inventory";

export const GET = route({ auth: { permission: "catalog:read" } }, async (ctx) => adminListInventory(ctx.query(inventoryQuery)));
