"use client";

import { useSearchParams } from "next/navigation";
import { ProductEditor } from "@/admin/views/product-editor";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  const from = useSearchParams().get("from");
  return (
    <RequirePermission permission="catalog:write">
      <ProductEditor key={from ?? "new"} duplicateOf={from} />
    </RequirePermission>
  );
}
