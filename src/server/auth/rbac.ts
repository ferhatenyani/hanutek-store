/**
 * Role-based access control. Permissions are code-defined (reviewable in PRs,
 * no runtime drift); roles map to permission sets. Add roles/permissions here
 * as the admin app grows.
 */
export const PERMISSIONS = [
  "catalog:read",
  "catalog:write",
  "inventory:write",
  "orders:read",
  "orders:write",
  "customers:read",
  "customers:write",
  "promotions:write",
  "reviews:moderate",
  "media:write",
  "audit:read",
  "users:manage_roles",
  /** Store configuration: carriers, operational tools. */
  "settings:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Role = "customer" | "staff" | "admin";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: [],
  staff: [
    "catalog:read",
    "catalog:write",
    "inventory:write",
    "orders:read",
    "orders:write",
    "customers:read",
    "reviews:moderate",
    "media:write",
  ],
  admin: PERMISSIONS,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const permissionsOf = (role: Role): readonly Permission[] => ROLE_PERMISSIONS[role];

/** Roles that may sign in to the admin app. */
export const isStaffRole = (role: Role) => role === "staff" || role === "admin";

/** Read-only matrix for the admin "Roles & permissions" screen. */
export const roleMatrix = () => (Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => ({ role, permissions: [...ROLE_PERMISSIONS[role]] }));
