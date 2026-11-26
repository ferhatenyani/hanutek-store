"use client";

import { CustomersPage } from "@/admin/views/customers";
import { RequirePermission } from "@/admin/shell/session";
import { PageHeader } from "@/admin/ui/core";

export default function Page() {
  return (
    <RequirePermission permission="customers:read">
      <PageHeader title="Clients" description="Tous les titulaires d’un compte boutique, leurs commandes et leur valeur client." />
      <CustomersPage />
    </RequirePermission>
  );
}
