import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyEmail } from "./form";

export const metadata: Metadata = { title: "Vérification de l’e-mail", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
