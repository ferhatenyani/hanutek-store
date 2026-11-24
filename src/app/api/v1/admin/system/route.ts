import { route } from "@/server/lib/http";
import { systemStatus } from "@/server/services/admin-content";

export const GET = route({ auth: { permission: "settings:manage" } }, async () => systemStatus());
