"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Download, Mail, Minus, ScrollText, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, adminApi, errorMessage, invalidate, useApi, withQuery } from "../lib/client";
import { downloadUrl, fmtDate, fmtFull, num } from "../lib/format";
import { PERMISSION_LABEL, ROLE, actionLabel } from "../lib/meta";
import type { AuditRow, CustomerRow, Paged, Subscriber } from "../lib/types";
import { useUrlState } from "../data/state";
import { DataTable, Pagination, type Column } from "../data/table";
import { FilterSelect, ResetFilters, SearchBox, Toolbar } from "../data/toolbar";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Mono, PageHeader, Skeleton } from "../ui/core";
import { Dialog, Drawer, Select, Tabs, useConfirm, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";
import { CustomersPage } from "./customers";
import { useTheme as useThemePref } from "../shell/theme";

/* ------------------------------------------------------------------ Team */

export function TeamPage() {
  const { can } = useSession();
  const { state } = useUrlState({ tab: "" });
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeader
        title="Team & roles"
        description="Who can use the console, and what each role is allowed to do."
        actions={
          can("users:manage_roles") && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <UserPlus size={15} /> Add team member
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Tabs
          value={state.tab}
          onChange={(v) => window.history.replaceState(null, "", v ? `?tab=${v}` : window.location.pathname)}
          tabs={[
            { value: "", label: "Members" },
            { value: "roles", label: "Roles & permissions" },
          ]}
        />
      </div>
      {state.tab === "roles" ? <RoleMatrix /> : <CustomersPage team />}
      {adding && <AddMember onClose={() => setAdding(false)} />}
    </>
  );
}

function RoleMatrix() {
  const q = useApi<{ permissions: string[]; roles: { role: string; permissions: string[] }[] }>("/admin/roles");
  if (!q.data) return <Skeleton className="h-96" />;
  const roles = q.data.roles.filter((r) => r.role !== "customer");
  return (
    <Card padded={false}>
      <div className="ad-scroll overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13px]">
          <caption className="sr-only">Permissions per role</caption>
          <thead>
            <tr className="border-b border-ad-border">
              <th scope="col" className="h-10 px-4 text-start text-xs font-medium text-ad-muted sm:px-5">
                Permission
              </th>
              {roles.map((r) => (
                <th key={r.role} scope="col" className="w-28 px-3 text-center">
                  <Badge tone={ROLE[r.role].tone}>{ROLE[r.role].label}</Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ad-border">
            {q.data.permissions.map((p) => (
              <tr key={p}>
                <th scope="row" className="px-4 py-2.5 text-start font-normal sm:px-5">
                  <span className="block text-ad-fg">{PERMISSION_LABEL[p] ?? p}</span>
                  <Mono className="text-[11.5px] text-ad-faint">{p}</Mono>
                </th>
                {roles.map((r) => (
                  <td key={r.role} className="text-center">
                    {r.permissions.includes(p) ? <Check size={15} className="mx-auto text-ad-green" aria-label="Allowed" /> : <Minus size={15} className="mx-auto text-ad-faint" aria-label="Not allowed" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-ad-border px-4 py-3 text-xs text-ad-muted sm:px-5">Permissions are defined in code and enforced by the API on every request. Changing someone&apos;s role signs them out everywhere.</p>
    </Card>
  );
}

function AddMember({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [found, setFound] = useState<CustomerRow | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const lookup = async () => {
    setPending(true);
    try {
      const r = await adminApi<Paged<CustomerRow>>(withQuery("/admin/customers", { search: email.trim(), pageSize: 5 }));
      setFound(r.items.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null);
    } catch (err) {
      toast.error("Search failed", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  const grant = async () => {
    if (!found) return;
    if (!(await confirm({ title: `Give ${found.name} ${ROLE[role].label.toLowerCase()} access?`, description: "They'll be signed out and can then sign in to the console.", confirmLabel: "Grant access", typeToConfirm: role === "admin" ? found.email : undefined }))) return;
    setPending(true);
    try {
      await adminApi(`/admin/customers/${found.id}`, { method: "PATCH", body: { role } });
      invalidate("/admin/customers");
      toast.success(`${found.name} is now ${ROLE[role].label.toLowerCase()}`);
      onClose();
    } catch (err) {
      toast.error("Couldn't change the role", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add team member"
      description="Team members sign in with their own store account. Ask them to create one first, then grant access here."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {found ? (
            <Button variant="primary" loading={pending} onClick={grant}>
              Grant access
            </Button>
          ) : (
            <Button variant="primary" loading={pending} disabled={!email.includes("@")} onClick={lookup}>
              Find account
            </Button>
          )}
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void (found ? grant() : lookup());
        }}
      >
        <Field label="Account email" htmlFor="tm-email">
          <Input
            id="tm-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFound(undefined);
            }}
            placeholder="name@example.com"
            data-autofocus
          />
        </Field>
        {found === null && <p className="rounded-md bg-ad-amber-soft px-3 py-2 text-[13px] text-ad-amber">No account uses this email. Ask the person to register on the store first.</p>}
        {found && (
          <div className="flex items-center gap-3 rounded-md border border-ad-border p-3">
            <Avatar name={found.name} />
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="font-medium">{found.name}</p>
              <p className="truncate text-ad-muted">
                {found.email} · currently {ROLE[found.role].label.toLowerCase()}
              </p>
            </div>
            <div className="w-28">
              <Select ariaLabel="New role" size="sm" value={role} onChange={setRole} options={[{ value: "staff", label: "Staff" }, { value: "admin", label: "Admin" }]} />
            </div>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Audit log */

const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setMinutes(0, 0, 0); // stable for an hour so the query key doesn't change every render
  return new Date(d.getTime() - days * 86400_000).toISOString();
};

const entityHref = (a: AuditRow) => {
  if (!a.entityId) return null;
  switch (a.entityType) {
    case "order":
      return `/admin/orders/${a.entityId}`;
    case "product":
      return `/admin/products/${a.entityId}`;
    case "user":
      return `/admin/customers/${a.entityId}`;
    case "promotion":
      return `/admin/promotions?id=${a.entityId}`;
    case "review":
      return null;
    default:
      return null;
  }
};

export function AuditPage() {
  const { state, set, reset, activeCount } = useUrlState({ q: "", entity: "", range: "", page: "1" });
  const from = state.range ? daysAgoIso(Number(state.range)) : "";
  const q = useApi<Paged<AuditRow> & { entityTypes: string[] }>(withQuery("/admin/audit", { q: state.q, entityType: state.entity, from, page: state.page, pageSize: 50 }));
  const [open, setOpen] = useState<AuditRow | null>(null);
  const setQ = useCallback((v: string) => set({ q: v }), [set]);
  const columns: Column<AuditRow>[] = [
    { id: "when", header: "When", width: "170px", mobile: true, cell: (a) => <span className="whitespace-nowrap text-ad-muted">{fmtFull(a.createdAt)}</span> },
    {
      id: "actor",
      header: "Who",
      mobile: true,
      cell: (a) => (
        <span className="flex items-center gap-2">
          <Avatar name={a.actorName ?? "System"} size={22} />
          <span className="truncate">{a.actorName ?? "System"}</span>
        </span>
      ),
    },
    { id: "action", header: "Action", primary: true, cell: (a) => <span className="font-medium">{actionLabel(a.action)}</span> },
    {
      id: "entity",
      header: "Target",
      cell: (a) => {
        const href = entityHref(a);
        const label = (
          <span className="flex items-center gap-1.5">
            <Badge>{a.entityType}</Badge>
            {a.entityId && <Mono className="truncate text-ad-muted">{a.entityId.length > 14 ? `${a.entityId.slice(0, 8)}…` : a.entityId}</Mono>}
          </span>
        );
        return href ? (
          <Link href={href} className="hover:underline" data-no-row-click>
            {label}
          </Link>
        ) : (
          label
        );
      },
    },
    { id: "ip", header: "IP", width: "120px", cell: (a) => <Mono className="text-ad-faint">{a.ip ?? "—"}</Mono> },
  ];
  return (
    <>
      <PageHeader title="Audit log" description="Every administrative change, who made it and from where. Entries can't be edited or deleted." />
      <Card padded={false}>
        <Toolbar>
          <SearchBox value={state.q} onChange={setQ} placeholder="Action, target, person…" label="Search audit log" />
          <FilterSelect label="Target" value={state.entity} onChange={(v) => set({ entity: v })} options={(q.data?.entityTypes ?? []).map((t) => ({ value: t, label: t, text: t }))} />
          <FilterSelect
            label="Period"
            allLabel="All time"
            width="w-[170px]"
            value={state.range as "" | "1"}
            onChange={(v) => set({ range: v })}
            options={[
              { value: "1", label: "Last 24 hours", text: "Last 24 hours" },
              { value: "7" as "1", label: "Last 7 days", text: "Last 7 days" },
              { value: "30" as "1", label: "Last 30 days", text: "Last 30 days" },
            ]}
          />
          <ResetFilters count={activeCount + (state.q ? 1 : 0)} onReset={reset} />
        </Toolbar>
        <DataTable label="Audit log" rows={q.data?.items} rowId={(a) => a.id} columns={columns} loading={q.loading} stale={q.stale} error={q.error} onRetry={q.reload} onRowClick={setOpen} empty={<EmptyState icon={<ScrollText size={18} />} title="No entries" />} />
        <Pagination page={Number(state.page)} pageSize={50} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} />
      </Card>
      {open && (
        <Drawer open onClose={() => setOpen(null)} width={560} title={actionLabel(open.action)} description={`${open.actorName ?? "System"} · ${fmtFull(open.createdAt)}`}>
          <dl className="mb-5 grid grid-cols-[100px_1fr] gap-y-2 text-[13px]">
            <dt className="text-ad-muted">Actor</dt>
            <dd>{open.actorEmail ?? "—"}</dd>
            <dt className="text-ad-muted">Target</dt>
            <dd>
              {open.entityType} <Mono className="text-ad-muted">{open.entityId}</Mono>
            </dd>
            <dt className="text-ad-muted">IP</dt>
            <dd>
              <Mono>{open.ip ?? "—"}</Mono>
            </dd>
            <dt className="text-ad-muted">Device</dt>
            <dd className="break-words text-ad-muted">{open.userAgent ?? "—"}</dd>
          </dl>
          <div className="grid gap-3">
            {(["before", "after"] as const).map((k) => (
              <div key={k}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ad-faint">{k}</p>
                <pre className="ad-scroll max-h-72 overflow-auto rounded-md border border-ad-border bg-ad-subtle p-3 font-[family-name:var(--font-admin-mono)] text-[12px] leading-relaxed">
                  {open[k] === null || open[k] === undefined ? "—" : JSON.stringify(open[k], null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Subscribers */

export function SubscribersPage() {
  const { state, set } = useUrlState({ q: "", status: "", page: "1" });
  const q = useApi<Paged<Subscriber>>(withQuery("/admin/newsletter", { q: state.q, status: state.status, page: state.page, pageSize: 50 }));
  const setQ = useCallback((v: string) => set({ q: v }), [set]);
  const columns: Column<Subscriber>[] = [
    { id: "email", header: "Email", primary: true, cell: (s) => <span className="font-medium">{s.email}</span> },
    { id: "locale", header: "Language", mobile: true, width: "110px", cell: (s) => <Badge>{s.locale === "ar" ? "Arabic" : "French"}</Badge> },
    { id: "status", header: "Status", mobile: true, width: "140px", cell: (s) => (s.unsubscribedAt ? <Badge>Unsubscribed</Badge> : <Badge tone="green" dot>Subscribed</Badge>) },
    { id: "date", header: "Since", align: "end", width: "140px", cell: (s) => <span className="text-ad-muted">{fmtDate(s.createdAt)}</span> },
  ];
  return (
    <>
      <PageHeader
        title="Subscribers"
        description="Newsletter sign-ups from the store footer."
        actions={
          <Button onClick={() => downloadUrl("/api/v1/admin/newsletter/export")}>
            <Download size={14} /> Export subscribed
          </Button>
        }
      />
      <Card padded={false}>
        <Toolbar>
          <SearchBox value={state.q} onChange={setQ} placeholder="Search emails…" label="Search subscribers" />
          <FilterSelect
            label="Status"
            value={state.status as "" | "subscribed"}
            onChange={(v) => set({ status: v })}
            options={[
              { value: "subscribed", label: "Subscribed", text: "Subscribed" },
              { value: "unsubscribed" as "subscribed", label: "Unsubscribed", text: "Unsubscribed" },
            ]}
          />
        </Toolbar>
        <DataTable label="Subscribers" rows={q.data?.items} rowId={(s) => s.id} columns={columns} loading={q.loading} stale={q.stale} error={q.error} onRetry={q.reload} empty={<EmptyState icon={<Mail size={18} />} title="No subscribers" />} />
        <Pagination page={Number(state.page)} pageSize={50} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ Settings */

interface SystemStatus {
  database: { ok: boolean; engine: string; latencyMs: number };
  counts: Record<string, number>;
  config: Record<string, string | number | boolean>;
}

export function SettingsPage() {
  const { can } = useSession();
  const { state } = useUrlState({ tab: "" });
  const tabs = [
    { value: "", label: "Account" },
    ...(can("settings:manage") ? [{ value: "system", label: "System" }] : []),
  ];
  return (
    <>
      <PageHeader title="Settings" description="Your account and, for admins, store operations." />
      <div className="mb-4">
        <Tabs value={state.tab} onChange={(v) => window.history.replaceState(null, "", v ? `?tab=${v}` : window.location.pathname)} tabs={tabs} />
      </div>
      {state.tab === "system" && can("settings:manage") ? <SystemSettings /> : <AccountSettings />}
    </>
  );
}

function AccountSettings() {
  const { user, refresh } = useSession();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [savingPw, setSavingPw] = useState(false);
  const { pref, setPref } = useThemePref();

  const saveName = async () => {
    if (name.trim().length < 2) return toast.error("Name must be at least 2 characters");
    setSavingName(true);
    try {
      await adminApi("/me", { method: "PATCH", body: { name: name.trim() } });
      await refresh();
      toast.success("Name updated");
    } catch (err) {
      toast.error("Couldn't save", errorMessage(err));
    } finally {
      setSavingName(false);
    }
  };
  const savePw = async () => {
    const e: Record<string, string> = {};
    if (!pw.current) e.current = "Enter your current password";
    if (pw.next.length < 8) e.next = "At least 8 characters";
    if (pw.next !== pw.confirm) e.confirm = "Passwords don't match";
    setPwErr(e);
    if (Object.keys(e).length) return;
    setSavingPw(true);
    try {
      await adminApi("/auth/password/change", { method: "POST", body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed", "Your other sessions were signed out.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") setPwErr({ current: "Incorrect password" });
      else toast.error("Couldn't change password", errorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader title="Profile" description={`Signed in as ${user.email} · ${ROLE[user.role].label}`} />
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void saveName();
          }}
        >
          <Field label="Display name" htmlFor="me-name" className="flex-1">
            <Input id="me-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" loading={savingName} disabled={name.trim() === user.name}>
            Save
          </Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Password" description="Changing it signs you out on your other devices." />
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void savePw();
          }}
        >
          <Field label="Current" htmlFor="pw-cur" error={pwErr.current}>
            <Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} invalid={Boolean(pwErr.current)} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="New" htmlFor="pw-new" error={pwErr.next}>
            <Input id="pw-new" type="password" autoComplete="new-password" value={pw.next} invalid={Boolean(pwErr.next)} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="Confirm new" htmlFor="pw-conf" error={pwErr.confirm}>
            <Input id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} invalid={Boolean(pwErr.confirm)} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" loading={savingPw}>
              Change password
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Appearance" description="Stored on this device." />
        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={pref === t}
              onClick={() => setPref(t)}
              className={cn("cursor-pointer rounded-lg border px-3 py-2.5 text-[13px] capitalize transition-colors", pref === t ? "border-ad-fg bg-ad-subtle font-medium" : "border-ad-border hover:border-ad-border-strong")}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}


function SystemSettings() {
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi<SystemStatus>("/admin/system");
  const [days, setDays] = useState("60");
  const [busy, setBusy] = useState<string | null>(null);
  const s = q.data;
  const purge = async () => {
    setBusy("purge");
    try {
      const dry = await adminApi<{ matched: number }>("/admin/system/purge-carts", { method: "POST", body: { days: Number(days), dryRun: true } });
      if (dry.matched === 0) {
        toast(`No guest carts older than ${days} days`);
        return;
      }
      if (!(await confirm({ title: `Delete ${dry.matched} abandoned guest cart${dry.matched === 1 ? "" : "s"}?`, description: `Guest carts untouched for ${days} days. They hold no stock; signed-in customers' carts are never touched.`, confirmLabel: "Delete carts", variant: "danger" }))) return;
      const r = await adminApi<{ deleted: number }>("/admin/system/purge-carts", { method: "POST", body: { days: Number(days) } });
      invalidate("/admin/system");
      toast.success(`${r.deleted} cart${r.deleted === 1 ? "" : "s"} deleted`);
    } catch (err) {
      toast.error("Cleanup failed", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const clearLimits = async () => {
    setBusy("limits");
    try {
      const r = await adminApi<{ deleted: number }>("/admin/system/rate-limits", { method: "POST" });
      invalidate("/admin/system");
      toast.success(`${r.deleted} expired counters removed`);
    } catch (err) {
      toast.error("Cleanup failed", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  if (!s) return <Skeleton className="h-96 max-w-3xl" />;
  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader title="Status" description={`Database ${s.database.engine} · ${s.database.latencyMs} ms`} actions={<Badge tone={s.database.ok ? "green" : "red"} dot>{s.database.ok ? "Healthy" : "Unavailable"}</Badge>} />
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-ad-border bg-ad-border text-[13px] sm:grid-cols-4">
          {Object.entries(s.counts).map(([k, v]) => (
            <div key={k} className="bg-ad-panel p-3">
              <dt className="text-xs capitalize text-ad-muted">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
              <dd className="tnum mt-0.5 font-semibold">{num(v)}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <CardHeader title="Configuration" description="Read-only; set through environment variables on the server." />
        <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[13px]">
          {Object.entries(s.config).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ad-muted">{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</dt>
              <dd>
                <Mono>{String(v)}</Mono>
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <CardHeader title="Housekeeping" />
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-[13px]">
              <p className="font-medium">Abandoned guest carts</p>
              <p className="text-ad-muted">{num(s.counts.staleGuestCarts)} older than 60 days.</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="w-36">
                <Select size="sm" ariaLabel="Older than" value={days} onChange={setDays} options={["30", "60", "90", "180"].map((d) => ({ value: d, label: `Older than ${d} days` }))} />
              </div>
              <Button size="sm" loading={busy === "purge"} onClick={purge}>
                Clean up
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-ad-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px]">
              <p className="font-medium">Expired rate-limit counters</p>
              <p className="text-ad-muted">{num(s.counts.expiredRateLimits)} expired entries.</p>
            </div>
            <Button size="sm" loading={busy === "limits"} onClick={clearLimits}>
              Clear
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
