import type { Metadata } from "next";
import { Inter, Space_Grotesk, Space_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["500", "600", "700"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"] });
const arabic = IBM_Plex_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: {
    default: "hanutek — Équipement auto pour l'Algérie",
    template: "%s · hanutek",
  },
  description:
    "Dash cams, boosters, organisateurs et plus. Du matériel auto testé sur route, livré partout en Algérie.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      dir="ltr"
      className={`${inter.variable} ${grotesk.variable} ${spaceMono.variable} ${arabic.variable} h-full`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
