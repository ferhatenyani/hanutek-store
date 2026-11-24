"use client";

import { OrdersPage } from "@/admin/views/orders";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="orders:read">
      <OrdersPage />
    </RequirePermission>
  );
}
