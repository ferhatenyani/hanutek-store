"use client";

import { ReviewsPage } from "@/admin/views/reviews";
import { RequirePermission } from "@/admin/shell/session";

export default function Page() {
  return (
    <RequirePermission permission="reviews:moderate">
      <ReviewsPage />
    </RequirePermission>
  );
}
