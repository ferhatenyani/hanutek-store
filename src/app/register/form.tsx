"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n/provider";
import { Button, Input } from "@/components/ui/primitives";
import { AuthShell, MockNote } from "@/components/auth-shell";
import { useToast } from "@/components/ui/toast";

export function RegisterForm() {
  const { register } = useStore();
  const { m } = useI18n();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/profile";
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError(m.auth.errName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError(m.auth.errEmail);
    if (password.length < 6) return setError(m.auth.errPasswordRegister);
    if (!terms) return setError(m.auth.errTerms);
    setError("");
    setBusy(true);
    window.setTimeout(() => {
      register(name.trim(), email);
      toast(m.auth.accountCreatedToast);
      router.replace(next);
    }, 500);
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
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label={m.auth.name} value={name} onChange={(e) => setName(e.target.value)} placeholder={m.auth.namePlaceholder} autoComplete="name" />
        <Input label={m.auth.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" dir="ltr" />
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
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? m.auth.creatingAccount : m.auth.registerCta}
        </Button>
      </form>
      <MockNote>{m.auth.registerMockNote}</MockNote>
    </AuthShell>
  );
}
