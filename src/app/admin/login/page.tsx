import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminLogin } from "@/admin/views/login";

export const metadata: Metadata = { title: "Connexion" };

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLogin />
    </Suspense>
  );
}
