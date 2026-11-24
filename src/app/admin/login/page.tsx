import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminLogin } from "@/admin/views/login";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLogin />
    </Suspense>
  );
}
