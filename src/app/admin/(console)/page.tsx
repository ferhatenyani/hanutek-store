"use client";

import { Dashboard } from "@/admin/views/dashboard";
import { RequirePermission } from "@/admin/shell/session";

export default function AdminHome() {
  return (
    <RequirePermission permission="orders:read">
      <Dashboard />
    </RequirePermission>
  );
}
