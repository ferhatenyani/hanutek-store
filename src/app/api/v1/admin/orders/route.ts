import { route } from "@/server/lib/http";
import { adminOrderQuery } from "@/server/validation";
import { adminListOrders } from "@/server/services/orders";

export const GET = route({ auth: { permission: "orders:read" } }, async (ctx) => adminListOrders(ctx.query(adminOrderQuery)));
