import { Suspense } from "react";
import { AdminSessionGate } from "@/admin/shell/session";
import { AdminShell } from "@/admin/shell/shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionGate>
      <AdminShell>
        <Suspense>{children}</Suspense>
      </AdminShell>
    </AdminSessionGate>
  );
}
