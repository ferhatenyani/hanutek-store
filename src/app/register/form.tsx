"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Input } from "@/components/ui/primitives";
import { AuthShell, MockNote } from "@/components/auth-shell";
import { useToast } from "@/components/ui/toast";

export function RegisterForm() {
  const { register } = useStore();
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
    if (name.trim().length < 2) return setError("Enter your full name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (!terms) return setError("Please accept the demo terms to continue");
    setError("");
    setBusy(true);
    window.setTimeout(() => {
      register(name.trim(), email);
      toast("Account created — welcome to hanutek");
      router.replace(next);
    }, 500);
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for orders, tracking and faster checkout."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" transitionTypes={["nav-back"]} className="font-medium text-accent-ink hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Full name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Driver" autoComplete="name" />
        </label>
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
              placeholder="At least 6 characters"
              autoComplete="new-password"
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
        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#0f71fa]"
          />
          <span>
            I understand this is a frontend demo with mock data, and I agree to the imaginary terms of service.
          </span>
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <MockNote>Demo registration — accounts are stored locally in your browser only.</MockNote>
    </AuthShell>
  );
}