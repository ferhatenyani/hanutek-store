import { Suspense } from "react";
import type { Metadata } from "next";
import { ForgotForm } from "./form";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
