"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, LogOut, Moon, Package, Plus, ReceiptText, Search, Sun, TicketPercent, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminApi, withQuery } from "../lib/client";
import { dzd } from "../lib/format";
import { ORDER_STATUS, PRODUCT_STATUS } from "../lib/meta";
import { Portal, useLayer } from "../ui/floating";
import { Kbd, Spinner } from "../ui/core";
import { ALL_NAV } from "./nav";
import { useSession } from "./session";
import { useTheme } from "./theme";

interface Cmd {
  id: string;
  group: string;
  label: ReactNode;
  text: string;
  icon?: ReactNode;
  hint?: ReactNode;
  run: () => void;
}

type SearchHit = Cmd;

/**
 * ⌘K / Ctrl+K command palette: navigation, quick actions and live search
 * across orders, products and customers (each only with the permission).
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { can, signOut } = useSession();
  const { pref, setPref } = useTheme();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const isTop = useLayer(open);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const base: Cmd[] = useMemo(() => {
    const nav = ALL_NAV.filter((n) => !n.permission || can(n.permission)).map<Cmd>((n) => ({
      id: `nav:${n.href}`,
      group: "Aller à",
      label: n.label,
      text: `${n.label} ${n.keywords ?? ""}`,
      icon: <n.icon size={15} />,
      hint: n.key ? (
        <span className="flex gap-1">
          <Kbd>G</Kbd>
          <Kbd>{n.key.toUpperCase()}</Kbd>
        </span>
      ) : undefined,
      run: () => go(n.href),
    }));
    const actions: Cmd[] = [];
    if (can("catalog:write")) actions.push({ id: "new-product", group: "Actions", label: "Nouveau produit", text: "nouveau produit créer ajouter", icon: <Plus size={15} />, run: () => go("/admin/products/new") });
    if (can("promotions:write")) actions.push({ id: "new-promo", group: "Actions", label: "Nouveau code promo", text: "nouveau code promo réduction coupon", icon: <TicketPercent size={15} />, run: () => go("/admin/promotions?new=1") });
    actions.push({
      id: "theme",
      group: "Actions",
      label: pref === "dark" ? "Passer au thème clair" : "Passer au thème sombre",
      text: "thème sombre clair mode apparence",
      icon: pref === "dark" ? <Sun size={15} /> : <Moon size={15} />,
      run: () => {
        setPref(pref === "dark" ? "light" : "dark");
        onClose();
      },
    });
    actions.push({ id: "signout", group: "Actions", label: "Se déconnecter", text: "se déconnecter déconnexion", icon: <LogOut size={15} />, run: () => void signOut() });
    return [...nav, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can, pref]);

  // live search
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      const tasks: Promise<SearchHit[]>[] = [];
      if (can("orders:read"))
        tasks.push(
          adminApi<{ items: { number: string; status: keyof typeof ORDER_STATUS; total: number; customer: { name: string } }[] }>(withQuery("/admin/orders", { q: term, pageSize: 5 }), { signal: ctrl.signal }).then((r) =>
            r.items.map((o) => ({
              id: `o:${o.number}`,
              group: "Commandes",
              label: (
                <span>
                  <span className="font-[family-name:var(--font-admin-mono)]">{o.number}</span> <span className="text-ad-muted">· {o.customer.name}</span>
                </span>
              ),
              text: o.number,
              icon: <ReceiptText size={15} />,
              hint: `${ORDER_STATUS[o.status].label} · ${dzd(o.total)}`,
              run: () => go(`/admin/orders/${o.number}`),
            })),
          ),
        );
      if (can("catalog:read"))
        tasks.push(
          adminApi<{ items: { id: string; name: string; status: string }[] }>(withQuery("/admin/products", { search: term, pageSize: 5 }), { signal: ctrl.signal }).then((r) =>
            r.items.map((p) => ({ id: `p:${p.id}`, group: "Produits", label: p.name, text: p.name, icon: <Package size={15} />, hint: PRODUCT_STATUS[p.status]?.label ?? p.status, run: () => go(`/admin/products/${p.id}`) })),
          ),
        );
      if (can("customers:read"))
        tasks.push(
          adminApi<{ items: { id: string; name: string; email: string }[] }>(withQuery("/admin/customers", { search: term, pageSize: 5 }), { signal: ctrl.signal }).then((r) =>
            r.items.map((c) => ({ id: `c:${c.id}`, group: "Clients", label: c.name, text: c.name, icon: <User size={15} />, hint: c.email, run: () => go(`/admin/customers/${c.id}`) })),
          ),
        );
      const settled = await Promise.allSettled(tasks);
      if (ctrl.signal.aborted) return;
      setHits(settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])));
      setSearching(false);
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(t);
      setSearching(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const local = term ? base.filter((c) => c.text.toLowerCase().includes(term)) : base;
    return [...local, ...hits];
  }, [q, base, hits]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset highlight when results change
    setActive(0);
  }, [q, hits.length]);
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fresh palette each time
      setQ("");
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTop()) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isTop, onClose]);

  if (!open) return null;
  const groups = [...new Set(filtered.map((c) => c.group))];
  let idx = -1;
  return (
    <Portal>
      <div className="fixed inset-0 z-[75] flex items-start justify-center px-3 pt-[12vh]">
        <div className="ad-anim-fade absolute inset-0 bg-[var(--ad-overlay)]" onClick={onClose} aria-hidden />
        <div role="dialog" aria-modal="true" aria-label="Palette de commandes" className="ad-anim-dialog relative w-full max-w-xl overflow-hidden rounded-xl border border-ad-border bg-ad-panel shadow-ad-pop">
          <div className="flex items-center gap-2.5 border-b border-ad-border px-4">
            <Search size={16} className="shrink-0 text-ad-faint" aria-hidden />
            <input
              ref={input}
              role="combobox"
              aria-expanded
              aria-controls="cmdk-list"
              aria-activedescendant={filtered[active] ? `cmdk-${filtered[active].id}` : undefined}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(filtered.length - 1, a + 1)));
                if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
                if (e.key === "Enter" && filtered[active]) (e.preventDefault(), filtered[active].run());
              }}
              placeholder="Chercher une commande, un produit, un client ou aller à…"
              aria-label="Commande"
              className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ad-fg outline-none placeholder:text-ad-faint"
            />
            {searching ? <Spinner className="text-ad-faint" /> : <Kbd>Échap</Kbd>}
          </div>
          <div ref={list} id="cmdk-list" role="listbox" className="ad-scroll max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
            {filtered.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-ad-muted">{searching ? "Recherche…" : "Aucun résultat"}</p>}
            {groups.map((g) => (
              <div key={g} role="group" aria-label={g} className="mb-1">
                <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-ad-faint">{g}</p>
                {filtered
                  .filter((c) => c.group === g)
                  .map((c) => {
                    idx = filtered.indexOf(c);
                    const i = idx;
                    return (
                      <div
                        key={c.id}
                        id={`cmdk-${c.id}`}
                        data-idx={i}
                        role="option"
                        aria-selected={i === active}
                        onPointerMove={() => setActive(i)}
                        onClick={() => c.run()}
                        className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ad-fg", i === active && "bg-ad-hover")}
                      >
                        <span className="text-ad-muted">{c.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{c.label}</span>
                        {c.hint && <span className="shrink-0 text-xs text-ad-faint">{c.hint}</span>}
                        {i === active && <CornerDownLeft size={13} className="shrink-0 text-ad-faint" aria-hidden />}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}
