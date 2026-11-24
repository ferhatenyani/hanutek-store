"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n/provider";
import { Button, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth-shell";
import { useToast } from "@/components/ui/toast";

export function ResetForm() {
  const { m } = useI18n();
  const { reloadSession } = useStore();
  const router = useRouter();
  const toast = useToast();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? "" : m.auth.linkInvalid);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password.length < 8) return setError(m.auth.errPasswordRegister);
    if (password !== confirm) return setError(m.auth.errPasswordMatch);
    setBusy(true);
    setError("");
    try {
      await api("/auth/password/reset", { method: "POST", body: { token, password } });
      await reloadSession().catch(() => undefined);
      toast(m.auth.passwordUpdated);
      router.replace("/login");
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError && err.code === "TOKEN_INVALID" ? m.auth.linkInvalid : m.common.actionFailed);
    }
  };

  return (
    <AuthShell
      title={m.auth.resetTitle}
      subtitle={m.auth.resetSubtitle}
      footer={
        <Link href="/forgot-password" transitionTypes={["nav-back"]} className="font-medium text-accent-ink hover:underline">
          {m.auth.requestNewLink}
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label={m.auth.newPassword} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" dir="ltr" placeholder={m.auth.passwordPlaceholderRegister} maxLength={128} />
        <Input label={m.auth.confirmPassword} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" dir="ltr" maxLength={128} />
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy || !token}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {m.auth.savePassword}
        </Button>
      </form>
    </AuthShell>
  );
}
