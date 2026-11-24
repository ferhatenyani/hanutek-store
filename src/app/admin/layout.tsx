import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AdminProviders } from "@/admin/shell/providers";
import { THEME_SCRIPT } from "@/admin/shell/theme";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Admin · hanutek", template: "%s · hanutek admin" },
  robots: { index: false, follow: false },
};

/** Admin console root: its own fonts, theme and providers; no storefront chrome. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en" dir="ltr" className={`adm ${geist.variable} ${geistMono.variable} min-h-dvh text-[14px] antialiased`}>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <AdminProviders>{children}</AdminProviders>
    </div>
  );
}
