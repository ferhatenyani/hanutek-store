"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/i18n/provider";
import { Button, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth-shell";

export function ForgotForm() {
  const { m } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(m.auth.errEmail);
    setBusy(true);
    setError("");
    try {
      await api("/auth/password/forgot", { method: "POST", body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "RATE_LIMITED" ? m.common.tooMany : m.common.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={m.auth.forgotTitle}
      subtitle={m.auth.forgotSubtitle}
      footer={
        <Link href="/login" transitionTypes={["nav-back"]} className="font-medium text-accent-ink hover:underline">
          {m.auth.backToLogin}
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-xl bg-volt-soft p-4 text-sm text-accent-ink" role="status">
          <MailCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>{m.auth.forgotSent}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label={m.auth.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" dir="ltr" maxLength={254} />
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {m.auth.sendResetLink}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
