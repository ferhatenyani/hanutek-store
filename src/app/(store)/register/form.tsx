"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { safeNextPath } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { Button, Input } from "@/components/ui/primitives";
import { AuthShell } from "@/components/auth-shell";
import { useToast } from "@/components/ui/toast";
import { GoogleButton } from "@/app/(store)/login/form";

export function RegisterForm() {
  const { register, features } = useStore();
  const { m, locale } = useI18n();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) return setError(m.auth.errName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(m.auth.errEmail);
    if (password.length < 8) return setError(m.auth.errPasswordRegister);
    if (!terms) return setError(m.auth.errTerms);
    setError("");
    setBusy(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, locale });
      toast(m.auth.accountCreatedToast);
      router.replace(next);
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : "";
      setError(
        code === "EMAIL_TAKEN"
          ? m.auth.errEmailTaken
          : code === "VALIDATION"
            ? m.auth.errPasswordRegister
            : code === "RATE_LIMITED"
              ? m.common.tooMany
              : m.common.actionFailed,
      );
    }
  };

  return (
    <AuthShell
      title={m.auth.registerTitle}
      subtitle={m.auth.registerSubtitle}
      footer={
        <>
          {m.auth.haveAccount}{" "}
          <Link href="/login" transitionTypes={["nav-back"]} className="font-medium text-accent-ink hover:underline">
            {m.auth.loginCta}
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
        <Input label={m.auth.name} value={name} onChange={(e) => setName(e.target.value)} placeholder={m.auth.namePlaceholder} autoComplete="name" maxLength={80} />
        <Input label={m.auth.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" dir="ltr" maxLength={254} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">{m.auth.password}</span>
          <span className="relative block">
            <Input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={m.auth.passwordPlaceholderRegister}
              autoComplete="new-password"
              dir="ltr"
              className="pe-11"
              maxLength={128}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? m.auth.hidePassword : m.auth.showPassword}
              className="absolute top-1/2 end-3 -translate-y-1/2 cursor-pointer text-faint transition-colors hover:text-foreground"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-foreground"
          />
          <span>{m.auth.termsLabel}</span>
        </label>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? m.auth.creatingAccount : m.auth.registerCta}
        </Button>
      </form>
    </AuthShell>
  );
}
