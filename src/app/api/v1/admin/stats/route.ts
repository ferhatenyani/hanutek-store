import { route } from "@/server/lib/http";
import { dashboardStats } from "@/server/services/admin-ops";

export const GET = route({ auth: { permission: "orders:read" } }, async () => dashboardStats());
