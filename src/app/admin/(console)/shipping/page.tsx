"use client";

import { ShippingPage } from "@/admin/views/shipping";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="orders:read">
      <ShippingPage />
    </RequirePermission>
  );
}
