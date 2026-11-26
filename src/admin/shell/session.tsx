"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { adminApi, ApiError, errorMessage } from "../lib/client";
import { Button, Spinner } from "../ui/core";

export type Permission =
  | "catalog:read"
  | "catalog:write"
  | "inventory:write"
  | "orders:read"
  | "orders:write"
  | "customers:read"
  | "customers:write"
  | "promotions:write"
  | "reviews:moderate"
  | "media:write"
  | "audit:read"
  | "users:manage_roles"
  | "settings:manage";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "staff" | "admin";
}

interface Session {
  user: AdminUser;
  permissions: Permission[];
  can: (p: Permission) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionCtx = createContext<Session | null>(null);

export function useSession() {
  const s = useContext(SessionCtx);
  if (!s) throw new Error("useSession outside AdminSessionGate");
  return s;
}
export const useCan = () => useSession().can;

export async function signOutAdmin() {
  await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  window.location.assign("/admin/login");
}

/**
 * Client gate for the console. /admin/me confirms the account is staff and
 * returns its permissions (an expired access token is first renewed with the
 * refresh cookie). Every API call
 * is still authorized server-side; this only decides what to render.
 */
export function AdminSessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; user: AdminUser; permissions: Permission[] } | { status: "forbidden"; email?: string } | { status: "error"; message: string }>({
    status: "loading",
  });

  const load = useCallback(async () => {
    try {
      // adminApi restores an expired session through the refresh cookie before giving up
      const me = await adminApi<{ user: AdminUser; permissions: Permission[] }>("/admin/me", { noRedirect: true });
      setState({ status: "ready", user: me.user, permissions: me.permissions });
    } catch (err) {
      if (err instanceof ApiError && (err.code === "UNAUTHENTICATED" || err.code === "AUTH_EXPIRED")) {
        const next = window.location.pathname + window.location.search;
        window.location.replace(`/admin/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (err instanceof ApiError && err.code === "FORBIDDEN") return setState({ status: "forbidden" });
      setState({ status: "error", message: errorMessage(err, "Impossible de joindre le serveur.") });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session bootstrap on mount
    void load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy>
        <div className="flex items-center gap-2.5 text-[13px] text-ad-muted">
          <Spinner /> Chargement de la console…
        </div>
      </div>
    );
  }
  if (state.status === "forbidden") {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-lg border border-ad-border bg-ad-panel text-ad-muted">
            <ShieldAlert size={20} />
          </div>
          <h1 className="text-base font-semibold">Ce compte ne peut pas utiliser la console d’administration</h1>
          <p className="mt-1.5 text-[13px] text-ad-muted">Vous êtes connecté avec un compte client. Connectez-vous avec un compte équipe pour continuer.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => window.location.assign("/")}>Aller à la boutique</Button>
            <Button variant="primary" onClick={() => void signOutAdmin()}>
              Changer de compte
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-base font-semibold">Impossible de joindre le serveur</h1>
          <p className="mt-1.5 text-[13px] text-ad-muted">{state.message}</p>
          <Button className="mt-5" onClick={() => void load()}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }
  const session: Session = {
    user: state.user,
    permissions: state.permissions,
    can: (p) => state.permissions.includes(p),
    signOut: signOutAdmin,
    refresh: load,
  };
  return (
    <SessionCtx.Provider value={session}>
      {children}
    </SessionCtx.Provider>
  );
}

/** Renders children only with the permission; otherwise a clear notice (pages) or nothing (inline). */
export function RequirePermission({ permission, children, inline }: { permission: Permission; children: ReactNode; inline?: boolean }) {
  const { can } = useSession();
  if (can(permission)) return <>{children}</>;
  if (inline) return null;
  return (
    <div className="grid place-items-center px-6 py-24 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-lg border border-ad-border bg-ad-panel text-ad-muted">
          <ShieldAlert size={20} />
        </div>
        <h1 className="text-base font-semibold">Vous n’avez pas accès à cette page</h1>
        <p className="mt-1.5 text-[13px] text-ad-muted">Votre rôle n’inclut pas cette autorisation. Demandez-la à un administrateur si besoin.</p>
      </div>
    </div>
  );
}
