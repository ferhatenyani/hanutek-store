"use client";

import { TeamPage } from "@/admin/views/workspace";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="customers:read">
      <TeamPage />
    </RequirePermission>
  );
}
