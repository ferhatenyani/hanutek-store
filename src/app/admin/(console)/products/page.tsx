"use client";

import { ProductsPage } from "@/admin/views/products";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <ProductsPage />
    </RequirePermission>
  );
}
