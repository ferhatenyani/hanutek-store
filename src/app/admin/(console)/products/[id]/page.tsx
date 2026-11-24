"use client";

import { use } from "react";
import { ProductEditor } from "@/admin/views/product-editor";
import { RequirePermission } from "@/admin/shell/session";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission permission="catalog:read">
      <ProductEditor key={id} id={id} />
    </RequirePermission>
  );
}
