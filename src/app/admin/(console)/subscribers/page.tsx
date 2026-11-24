"use client";

import { SubscribersPage } from "@/admin/views/workspace";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="customers:read">
      <SubscribersPage />
    </RequirePermission>
  );
}
