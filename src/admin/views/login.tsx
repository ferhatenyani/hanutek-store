"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { safeNextPath } from "@/lib/utils";
import { adminApi, ApiError, errorMessage } from "../lib/client";
import { Button, Field, Input, Spinner } from "../ui/core";

/** Only admin paths are valid post-login destinations. */
const adminNext = (n: string | null) => {
  const p = safeNextPath(n, "/admin");
  return p.startsWith("/admin") && !p.startsWith("/admin/login") ? p : "/admin";
};

export function AdminLogin() {
  const sp = useSearchParams();
  const next = adminNext(sp.get("next"));
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(sp.get("expired") ? "Votre session a expiré. Reconnectez-vous pour continuer." : null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // already signed in as staff → straight to the console
  useEffect(() => {
    adminApi("/admin/me", { noRedirect: true })
      .then(() => window.location.replace(next))
      .catch(() => setChecking(false));
  }, [next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const f: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) f.email = "Saisissez une adresse e-mail valide";
    if (!password) f.password = "Saisissez votre mot de passe";
    setFields(f);
    if (Object.keys(f).length) return;
    setPending(true);
    setError(null);
    try {
      await adminApi("/auth/login", { method: "POST", body: { email: email.trim(), password }, noRedirect: true });
      try {
        await adminApi("/admin/me", { noRedirect: true });
      } catch (err) {
        if (err instanceof ApiError && err.code === "FORBIDDEN") {
          await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
          throw new ApiError(403, "NOT_STAFF", "Ce compte n’a pas accès à la console d’administration.");
        }
        throw err;
      }
      window.location.replace(next);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") return setError("E-mail ou mot de passe incorrect.");
        if (err.code === "ACCOUNT_LOCKED") return setError("Trop de tentatives échouées. Ce compte est verrouillé pendant quelques minutes.");
        if (err.code === "ACCOUNT_DISABLED") return setError("Ce compte a été désactivé.");
        if (err.code === "RATE_LIMITED") return setError("Trop de tentatives. Patientez un instant puis réessayez.");
        if (err.code === "NOT_STAFF") return setError(err.message);
        return setError(errorMessage(err, "Connexion impossible."));
      }
      setError("Connexion impossible. Vérifiez votre connexion et réessayez.");
    }
  };

  if (checking) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy>
        <Spinner className="text-ad-faint" />
      </div>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex items-center gap-2">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-ad-ink text-xs font-bold text-ad-ink-fg">
            h
          </span>
          <span className="text-[15px] font-semibold">hanutek</span>
          <span className="rounded border border-ad-border px-1.5 py-px text-[11px] font-medium text-ad-muted">Admin</span>
        </div>
        <h1 className="text-xl font-semibold tracking-[-0.015em]">Connexion à la console</h1>
        <p className="mt-1 text-[13px] text-ad-muted">Utilisez votre compte équipe. Les comptes clients ne peuvent pas se connecter ici.</p>

        <form onSubmit={submit} noValidate className="mt-7 space-y-4">
          {error && (
            <div role="alert" className="rounded-md border border-ad-red/25 bg-ad-red-soft px-3 py-2.5 text-[13px] text-ad-red">
              {error}
            </div>
          )}
          <Field label="E-mail" htmlFor="email" error={fields.email}>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              invalid={Boolean(fields.email)}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@hanutek.dz"
            />
          </Field>
          <Field label="Mot de passe" htmlFor="password" error={fields.password}>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                invalid={Boolean(fields.password)}
                onChange={(e) => setPassword(e.target.value)}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute end-1 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded text-ad-faint hover:text-ad-fg"
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={pending}>
            Se connecter
          </Button>
        </form>
        <p className="mt-6 text-[13px] text-ad-muted">
          Mot de passe oublié ?{" "}
          <a href="/forgot-password" className="text-ad-fg underline underline-offset-2">
            Le réinitialiser
          </a>
        </p>
      </div>
    </main>
  );
}
