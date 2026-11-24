import { route } from "@/server/lib/http";
import { AppError } from "@/server/lib/errors";
import { isStaffRole, permissionsOf } from "@/server/auth/rbac";

/** Identity + permissions of the signed-in staff member (drives admin UI gating; the API enforces every permission itself). */
export const GET = route({ auth: "required" }, async (ctx) => {
  const u = ctx.requireUser();
  if (!isStaffRole(u.role)) throw new AppError("FORBIDDEN", "Staff access only");
  return { user: { id: u.id, email: u.email, name: u.name, role: u.role }, permissions: permissionsOf(u.role) };
});
