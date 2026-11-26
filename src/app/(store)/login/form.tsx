"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { safeNextPath } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { Button, Input, PasswordField } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth-shell";
import { useToast } from "@/components/ui/toast";

export function GoogleButton({ next, label }: { next: string; label: string }) {
  return (
    <a
      href={`/api/v1/auth/google/start?next=${encodeURIComponent(next)}`}
      className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface text-sm font-medium text-foreground transition-colors duration-150 hover:border-faint"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-3.8 2.9C3.3 21.3 7.3 24 12 24z" />
        <path fill="#FBBC05" d="M5.1 14.4c-.3-.8-.4-1.6-.4-2.4s.2-1.6.4-2.4L1.3 6.7C.5 8.3 0 10.1 0 12s.5 3.7 1.3 5.3l3.8-2.9z" />
        <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.7l3.8 2.9c1-2.9 3.7-4.9 6.9-4.9z" />
      </svg>
      {label}
    </a>
  );
}

export function LoginForm() {
  const { login, features } = useStore();
  const { m } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const oauthError = params.get("error");
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(oauthError ? (oauthError === "google_cancelled" ? "" : m.auth.errGoogle) : "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(m.auth.errEmail);
    if (!password) return setError(m.auth.errPasswordLogin);
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast(m.auth.welcomeToast);
      router.replace(next);
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : "";
      setError(
        code === "INVALID_CREDENTIALS"
          ? m.auth.errInvalid
          : code === "ACCOUNT_LOCKED" || code === "RATE_LIMITED"
            ? m.auth.errLocked
            : code === "ACCOUNT_DISABLED"
              ? m.auth.errDisabled
              : m.common.actionFailed,
      );
    }
  };

  return (
    <AuthShell
      title={m.auth.loginTitle}
      subtitle={m.auth.loginSubtitle}
      footer={
        <>
          {m.auth.noAccount}{" "}
          <Link href={`/register${next !== "/profile" ? `?next=${encodeURIComponent(next)}` : ""}`} transitionTypes={["nav-forward"]} className="font-medium text-accent-ink hover:underline">
            {m.auth.registerCta}
          </Link>
        </>
      }
    >
      {features.google && (
        <>
          <GoogleButton next={next} label={m.auth.continueGoogle} />
          <div className="my-6 flex items-center gap-3 text-[11px] tracking-wide text-faint uppercase">
            <span className="h-px flex-1 bg-line" />
            {m.auth.orContinueWith}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label={m.auth.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" dir="ltr" maxLength={254} />
        <PasswordField
          label={m.auth.password}
          showLabel={m.auth.showPassword}
          hideLabel={m.auth.hidePassword}
          aside={
            <Link href="/forgot-password" transitionTypes={["nav-forward"]} className="text-xs text-accent-ink hover:underline">
              {m.auth.forgotPassword}
            </Link>
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          maxLength={128}
        />
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? m.auth.signingIn : m.auth.loginCta}
        </Button>
      </form>
    </AuthShell>
  );
}
