"use client";

import { CategoriesPage } from "@/admin/views/categories";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <CategoriesPage />
    </RequirePermission>
  );
}
