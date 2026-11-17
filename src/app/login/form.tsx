"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Apple, Eye, EyeOff, Globe, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Input } from "@/components/ui/primitives";
import { AuthShell, MockNote } from "@/components/auth-shell";
import { useToast } from "@/components/ui/toast";

export function LoginForm() {
  const { login } = useStore();
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    setError("");
    setBusy(true);
    window.setTimeout(() => {
      login(email);
      toast("Welcome back");
      router.replace(next);
    }, 500);
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to track orders and check out faster."
      footer={
        <>
          New to hanutek?{" "}
          <Link href="/register" transitionTypes={["nav-forward"]} className="font-medium text-accent-ink hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Password</span>
          <span className="relative block">
            <Input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-faint transition-colors hover:text-foreground"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] text-faint">
        <span className="h-px flex-1 bg-line" /> or continue with <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="gap-2" onClick={() => toast("Social sign-in is mocked in this demo")}>
          <Globe size={15} /> Google
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => toast("Social sign-in is mocked in this demo")}>
          <Apple size={15} /> Apple
        </Button>
      </div>

      <MockNote>Demo authentication — any email and password work. Nothing leaves your browser.</MockNote>
    </AuthShell>
  );
}