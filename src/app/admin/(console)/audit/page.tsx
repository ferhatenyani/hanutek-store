"use client";

import { AuditPage } from "@/admin/views/workspace";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="audit:read">
      <AuditPage />
    </RequirePermission>
  );
}
