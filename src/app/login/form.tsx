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

export function LoginForm() {
  const { login } = useStore();
  const { m } = useI18n();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/profile";
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError(m.auth.errEmail);
    if (password.length < 4) return setError(m.auth.errPasswordLogin);
    setError("");
    setBusy(true);
    window.setTimeout(() => {
      login(email);
      toast(m.auth.welcomeToast);
      router.replace(next);
    }, 500);
  };

  const social = (provider: string) => {
    login(`${provider.toLowerCase()}.driver@example.com`);
    toast(m.auth.socialMock);
    router.replace(next);
  };

  return (
    <AuthShell
      title={m.auth.loginTitle}
      subtitle={m.auth.loginSubtitle}
      footer={
        <>
          {m.auth.noAccount}{" "}
          <Link href="/register" className="font-medium text-accent-ink hover:underline">
            {m.auth.registerCta}
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => social("Google")} aria-label={`Google — ${m.auth.socialMock}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
            <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-3.8 2.9C3.3 21.3 7.3 24 12 24z" />
            <path fill="#FBBC05" d="M5.1 14.4c-.3-.8-.4-1.6-.4-2.4s.2-1.6.4-2.4L1.3 6.7C.5 8.3 0 10.1 0 12s.5 3.7 1.3 5.3l3.8-2.9z" />
            <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.7l3.8 2.9c1-2.9 3.7-4.9 6.9-4.9z" />
          </svg>
          Google
        </Button>
        <Button variant="outline" onClick={() => social("Apple")} aria-label={`Apple — ${m.auth.socialMock}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.53-3.23 0-1.44.66-2.2.47-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Apple
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3 text-[11px] tracking-wide text-faint uppercase">
        <span className="h-px flex-1 bg-line" />
        {m.auth.orContinueWith}
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label={m.auth.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" dir="ltr" />
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
            {m.auth.password}
            <Link href="/profile" className="font-normal text-accent-ink hover:underline">
              {m.auth.forgotPassword}
            </Link>
          </span>
          <span className="relative block">
            <Input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? m.auth.signingIn : m.auth.loginCta}
        </Button>
      </form>
      <MockNote>{m.auth.loginMockNote}</MockNote>
    </AuthShell>
  );
}
