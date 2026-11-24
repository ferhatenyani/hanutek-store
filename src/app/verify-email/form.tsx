"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n/provider";
import { buttonClasses } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth-shell";

/** Consumes the single-use verification token once (StrictMode-safe). */
export function VerifyEmail() {
  const { m } = useI18n();
  const { reloadSession } = useStore();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"pending" | "ok" | "error">(token ? "pending" : "error");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api("/auth/verify-email", { method: "POST", body: { token } })
      .then(() => {
        setState("ok");
        void reloadSession().catch(() => undefined);
      })
      .catch(() => setState("error"));
  }, [token, reloadSession]);

  return (
    <AuthShell title={m.auth.verifyTitle} subtitle="" footer={null}>
      <div className="flex flex-col items-center gap-4 py-4 text-center" role="status">
        {state === "pending" && <Loader2 size={28} className="animate-spin text-muted" aria-hidden />}
        {state === "ok" && <CheckCircle2 size={32} className="text-accent-ink" aria-hidden />}
        {state === "error" && <XCircle size={32} className="text-danger" aria-hidden />}
        <p className="text-sm text-muted">
          {state === "pending" ? m.common.loading : state === "ok" ? m.auth.verifyOk : m.auth.linkInvalid}
        </p>
        {state !== "pending" && (
          <Link href="/profile" className={buttonClasses("primary", "md")}>
            {m.auth.goToAccount}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
