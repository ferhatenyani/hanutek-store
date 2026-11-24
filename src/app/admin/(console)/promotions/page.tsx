"use client";

import { PromotionsPage } from "@/admin/views/promotions";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="promotions:write">
      <PromotionsPage />
    </RequirePermission>
  );
}
