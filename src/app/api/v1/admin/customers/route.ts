import { route } from "@/server/lib/http";
import { adminCustomerQuery } from "@/server/validation";
import { listCustomers } from "@/server/services/admin-ops";

export const GET = route({ auth: { permission: "customers:read" } }, async (ctx) => listCustomers(ctx.query(adminCustomerQuery)));
