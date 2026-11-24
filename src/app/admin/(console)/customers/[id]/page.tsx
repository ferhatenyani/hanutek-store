"use client";

import { use } from "react";
import { CustomerDetailPage } from "@/admin/views/customers";
import { RequirePermission } from "@/admin/shell/session";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission permission="customers:read">
      <CustomerDetailPage key={id} id={id} />
    </RequirePermission>
  );
}
