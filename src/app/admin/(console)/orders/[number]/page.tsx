"use client";

import { use } from "react";
import { OrderDetailPage } from "@/admin/views/order-detail";
import { RequirePermission } from "@/admin/shell/session";

export default function Page({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  return (
    <RequirePermission permission="orders:read">
      <OrderDetailPage number={decodeURIComponent(number)} />
    </RequirePermission>
  );
}
