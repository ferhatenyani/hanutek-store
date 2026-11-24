"use client";

import { InventoryPage } from "@/admin/views/inventory";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <InventoryPage />
    </RequirePermission>
  );
}
