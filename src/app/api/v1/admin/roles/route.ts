import { route } from "@/server/lib/http";
import { AppError } from "@/server/lib/errors";
import { PERMISSIONS, isStaffRole, roleMatrix } from "@/server/auth/rbac";

export const GET = route({ auth: "required" }, async (ctx) => {
  if (!isStaffRole(ctx.requireUser().role)) throw new AppError("FORBIDDEN", "Staff access only");
  return { permissions: PERMISSIONS, roles: roleMatrix() };
});
