import { AppShell } from "@/components/layout/app-shell";

/** Storefront chrome (header, dock, cart sheet, store providers). The admin app has its own shell. */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
