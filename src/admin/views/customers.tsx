"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { BadgeCheck, LogOut, Mail, Phone, ShieldOff, ShieldCheck, Star, Users } from "lucide-react";
import { adminApi, errorMessage, invalidate, useApi, withQuery } from "../lib/client";
import { ago, dzd, fmtDate, fmtFull, num, wilayaName } from "../lib/format";
import { ORDER_STATUS, ROLE, actionLabel } from "../lib/meta";
import type { CustomerDetail, CustomerRow, Paged } from "../lib/types";
import { useUrlState } from "../data/state";
import { DataTable, Pagination, nextSort, useColumns, type Column, type Sort } from "../data/table";
import { FilterSelect, ResetFilters, SavedViews, SearchBox, Toolbar } from "../data/toolbar";
import { Avatar, Badge, Button, Card, CardHeader, ErrorState, EmptyState, Mono, PageHeader, Skeleton } from "../ui/core";
import { Menu, Select, useConfirm, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";

export function CustomersPage({ team = false }: { team?: boolean }) {
  const { state, set, reset, activeCount, search } = useUrlState({ search: "", role: "", status: "", verified: "", sort: "created", dir: "desc", page: "1", pageSize: "25" });
  const q = useApi<Paged<CustomerRow>>(
    withQuery("/admin/customers", { search: state.search, role: team ? state.role : state.role || "customer", scope: team && !state.role ? "team" : "", status: state.status, verified: state.verified, sort: state.sort, dir: state.dir, page: state.page, pageSize: state.pageSize }),
  );
  const sort: Sort = { key: state.sort, dir: state.dir as Sort["dir"] };
  const columns = useMemo<Column<CustomerRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        primary: true,
        hideable: false,
        sortKey: "name",
        cell: (c) => (
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={c.name} size={30} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate font-medium">
                {c.name}
                {c.status === "disabled" && <Badge tone="red">Disabled</Badge>}
              </span>
              <span className="block truncate text-xs text-ad-muted">{c.email}</span>
            </span>
          </span>
        ),
      },
      ...(team ? [{ id: "role", header: "Role", mobile: true, width: "110px", cell: (c: CustomerRow) => <Badge tone={ROLE[c.role].tone}>{ROLE[c.role].label}</Badge> }] : []),
      { id: "phone", header: "Phone", width: "140px", cell: (c) => <span className="text-ad-muted">{c.phone ?? "—"}</span> },
      { id: "verified", header: "Email", width: "110px", defaultHidden: team, cell: (c) => (c.emailVerifiedAt ? <Badge tone="green">Verified</Badge> : <Badge>Unverified</Badge>) },
      { id: "orders", header: "Orders", sortKey: "orders", align: "end", mobile: !team, width: "90px", cell: (c) => num(c.orderCount) },
      { id: "spent", header: "Spent", sortKey: "spent", align: "end", mobile: !team, width: "130px", cell: (c) => <span className="font-medium">{dzd(c.totalSpent)}</span> },
      { id: "lastOrder", header: "Last order", width: "130px", defaultHidden: team, cell: (c) => <span className="text-ad-muted">{ago(c.lastOrderAt)}</span> },
      { id: "lastLogin", header: "Last sign-in", sortKey: "lastLogin", width: "130px", defaultHidden: !team, cell: (c) => <span className="text-ad-muted">{ago(c.lastLoginAt)}</span> },
      { id: "created", header: "Joined", sortKey: "created", align: "end", width: "120px", cell: (c) => <span className="text-ad-muted">{fmtDate(c.createdAt)}</span> },
    ],
    [team],
  );
  const cols = useColumns(team ? "team" : "customers", columns);
  const setSearch = useCallback((v: string) => set({ search: v }), [set]);

  return (
    <Card padded={false}>
      <Toolbar>
        <SearchBox value={state.search} onChange={setSearch} placeholder="Name, email or phone…" label={team ? "Search team" : "Search customers"} />
        {team && (
          <FilterSelect
            label="Role"
            value={state.role as "" | "staff"}
            onChange={(v) => set({ role: v })}
            allLabel="Staff & admins"
            width="w-[190px]"
            options={[
              { value: "staff", label: "Staff", text: "Staff" },
              { value: "admin" as "staff", label: "Admin", text: "Admin" },
            ]}
          />
        )}
        <FilterSelect
          label="Status"
          value={state.status as "" | "active"}
          onChange={(v) => set({ status: v })}
          options={[
            { value: "active", label: "Active", text: "Active" },
            { value: "disabled" as "active", label: "Disabled", text: "Disabled" },
          ]}
        />
        {!team && (
          <FilterSelect
            label="Email"
            value={state.verified as "" | "yes"}
            onChange={(v) => set({ verified: v })}
            options={[
              { value: "yes", label: "Verified", text: "Verified" },
              { value: "no" as "yes", label: "Unverified", text: "Unverified" },
            ]}
          />
        )}
        <ResetFilters count={activeCount + (state.search ? 1 : 0)} onReset={reset} />
        <div className="ms-auto flex items-center gap-2">
          {!team && <SavedViews tableId="customers" current={search} onApply={(qs) => window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)} />}
          {cols.menu}
        </div>
      </Toolbar>
      <DataTable
        label={team ? "Team members" : "Customers"}
        rows={q.data?.items}
        rowId={(c) => c.id}
        columns={cols.visible}
        loading={q.loading}
        stale={q.stale}
        error={q.error}
        onRetry={q.reload}
        sort={sort}
        onSort={(key) => {
          const n = nextSort(sort, key, key === "name" ? "asc" : "desc");
          set({ sort: n.key, dir: n.dir });
        }}
        rowHref={(c) => `/admin/customers/${c.id}`}
        empty={<EmptyState icon={<Users size={18} />} title="No one matches" description="Try a different search or filter." />}
      />
      <Pagination page={Number(state.page)} pageSize={Number(state.pageSize)} total={q.data?.total} onPage={(p) => set({ page: String(p) }, { keepPage: true })} onPageSize={(s) => set({ pageSize: String(s) })} />
    </Card>
  );
}

export function CustomerDetailPage({ id }: { id: string }) {
  const { user, can } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const key = `/admin/customers/${id}`;
  const q = useApi<{ customer: CustomerDetail }>(key);
  const c = q.data?.customer;

  if (q.error && !c)
    return (
      <>
        <PageHeader title="Customer" back={{ href: "/admin/customers", label: "Customers" }} />
        <Card>
          <ErrorState error={q.error} onRetry={q.reload} />
        </Card>
      </>
    );
  if (!c)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    );

  const self = c.id === user.id;
  const canWrite = can("customers:write") && !(c.role === "admin" && user.role !== "admin");
  const patch = async (body: Record<string, string>, msg: string) => {
    try {
      await adminApi(key, { method: "PATCH", body });
      invalidate(key, "/admin/customers");
      toast.success(msg);
    } catch (err) {
      toast.error("Couldn't update", errorMessage(err));
    }
  };
  const toggleStatus = async () => {
    const disabling = c.status === "active";
    if (
      !(await confirm(
        disabling
          ? { title: `Disable ${c.name}?`, description: "They're signed out everywhere and can't sign in until re-enabled. Their orders are kept.", confirmLabel: "Disable account", variant: "danger" }
          : { title: `Re-enable ${c.name}?`, description: "They'll be able to sign in again.", confirmLabel: "Enable account" },
      ))
    )
      return;
    await patch({ status: disabling ? "disabled" : "active" }, disabling ? "Account disabled" : "Account enabled");
  };
  const signOutAll = async () => {
    if (!(await confirm({ title: "Sign out of all devices?", description: `${c.name} will need to sign in again everywhere.`, confirmLabel: "Sign out everywhere" }))) return;
    try {
      await adminApi(`${key}/sessions`, { method: "DELETE" });
      invalidate(key);
      toast.success("Signed out everywhere");
    } catch (err) {
      toast.error("Couldn't sign out", errorMessage(err));
    }
  };
  const back = c.role === "customer" ? { href: "/admin/customers", label: "Customers" } : { href: "/admin/team", label: "Team & roles" };

  return (
    <>
      <PageHeader
        back={back}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name} size={36} />
            {c.name}
          </span>
        }
        meta={
          <>
            <Badge tone={ROLE[c.role].tone}>{ROLE[c.role].label}</Badge>
            {c.status === "disabled" && <Badge tone="red" dot>Disabled</Badge>}
            {self && <Badge>You</Badge>}
          </>
        }
        description={`Customer since ${fmtDate(c.createdAt)} · last sign-in ${ago(c.lastLoginAt)}`}
        actions={
          canWrite &&
          !self && (
            <Menu
              label="Account actions"
              items={[
                { label: "Sign out everywhere", icon: <LogOut size={14} />, onSelect: () => void signOutAll() },
                { type: "separator" },
                c.status === "active"
                  ? { label: "Disable account", icon: <ShieldOff size={14} />, danger: true, onSelect: () => void toggleStatus() }
                  : { label: "Enable account", icon: <ShieldCheck size={14} />, onSelect: () => void toggleStatus() },
              ]}
              trigger={(p) => <Button {...p}>Manage account</Button>}
            />
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ad-border bg-ad-border shadow-ad lg:grid-cols-4">
        {[
          ["Lifetime spend", dzd(c.stats.totalSpent), "Delivered orders"],
          ["Orders", num(c.stats.orderCount), `${c.stats.delivered} delivered · ${c.stats.cancelled} cancelled`],
          ["Average order", dzd(c.stats.avgOrderValue), "Delivered orders"],
          ["Last order", c.stats.lastOrderAt ? ago(c.stats.lastOrderAt) : "—", c.stats.firstOrderAt ? `First ${fmtDate(c.stats.firstOrderAt)}` : "No orders yet"],
        ].map(([label, value, sub]) => (
          <div key={label} className="bg-ad-panel p-4">
            <p className="text-[13px] text-ad-muted">{label}</p>
            <p className="tnum mt-1 text-xl font-semibold">{value}</p>
            <p className="mt-0.5 text-xs text-ad-faint">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card padded={false}>
            <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
              <h2 className="text-sm font-semibold">Orders</h2>
              {c.orders.length > 0 && can("orders:read") && (
                <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="text-[13px] text-ad-muted hover:text-ad-fg">
                  Open in orders
                </Link>
              )}
            </div>
            {c.orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ad-muted">No orders yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-ad-border">
                {c.orders.map((o) => (
                  <li key={o.number}>
                    <Link href={`/admin/orders/${o.number}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-ad-hover sm:px-5">
                      <Mono className="w-24 shrink-0">{o.number}</Mono>
                      <span className="min-w-0 flex-1 text-ad-muted">{fmtDate(o.placedAt)}</span>
                      <Badge tone={ORDER_STATUS[o.status].tone} dot>
                        {ORDER_STATUS[o.status].label}
                      </Badge>
                      <span className="tnum w-24 shrink-0 text-end font-medium">{dzd(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Reviews" description={`${c.reviews.length} written`} />
            {c.reviews.length === 0 ? (
              <p className="text-[13px] text-ad-muted">No reviews.</p>
            ) : (
              <ul className="space-y-3">
                {c.reviews.map((r) => (
                  <li key={r.id} className="rounded-md border border-ad-border p-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-0.5 text-ad-amber" aria-label={`${r.rating} out of 5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < r.rating ? "fill-current" : "opacity-30"} aria-hidden />
                        ))}
                      </span>
                      <Link href={`/admin/products/${r.productId}`} className="font-medium hover:underline">
                        {r.productName}
                      </Link>
                      {r.status === "hidden" && <Badge>Hidden</Badge>}
                      <span className="ms-auto text-xs text-ad-faint">{fmtDate(r.createdAt)}</span>
                    </div>
                    {r.title && <p className="mt-1.5 font-medium">{r.title}</p>}
                    <p className="mt-1 text-ad-muted">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Contact" />
            <ul className="space-y-2 text-[13px]">
              <li className="flex items-center gap-2">
                <Mail size={14} className="shrink-0 text-ad-faint" />
                <a href={`mailto:${c.email}`} className="truncate hover:underline">
                  {c.email}
                </a>
                {c.emailVerifiedAt && <BadgeCheck size={14} className="shrink-0 text-ad-green" aria-label="Verified" />}
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="shrink-0 text-ad-faint" />
                {c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : <span className="text-ad-faint">No phone</span>}
              </li>
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-ad-border pt-4 text-[13px]">
              <dt className="text-ad-muted">Language</dt>
              <dd>{c.locale === "ar" ? "Arabic" : "French"}</dd>
              <dt className="text-ad-muted">Google sign-in</dt>
              <dd>{c.googleLinked ? "Linked" : "No"}</dd>
              <dt className="text-ad-muted">Favourites</dt>
              <dd>{c.stats.favorites}</dd>
              <dt className="text-ad-muted">Active sessions</dt>
              <dd>{c.stats.activeSessions}</dd>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Addresses" />
            {c.addresses.length === 0 ? (
              <p className="text-[13px] text-ad-muted">No saved address.</p>
            ) : (
              <ul className="space-y-3 text-[13px]">
                {c.addresses.map((a) => (
                  <li key={a.id}>
                    <p className="flex items-center gap-2 font-medium">
                      {a.fullName} {a.isDefault && <Badge>Default</Badge>}
                    </p>
                    <p className="text-ad-muted">{a.line1}</p>
                    <p className="text-ad-muted">
                      {a.commune}, {wilayaName(a.wilaya)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {can("users:manage_roles") && !self && <RoleCard customer={c} onChange={(role) => patch({ role }, `Role changed to ${ROLE[role].label}`)} />}
          {c.activity.length > 0 && (
            <Card>
              <CardHeader title="Account history" />
              <ul className="space-y-2 text-[13px]">
                {c.activity.map((a) => (
                  <li key={a.id}>
                    <p>
                      {actionLabel(a.action)} <span className="text-ad-muted">by {a.actorName ?? "System"}</span>
                    </p>
                    <p className="text-xs text-ad-faint">{fmtFull(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function RoleCard({ customer, onChange }: { customer: CustomerDetail; onChange: (role: "customer" | "staff" | "admin") => void }) {
  const confirm = useConfirm();
  return (
    <Card>
      <CardHeader title="Access" description="Changing the role signs the person out everywhere." />
      <Select
        ariaLabel="Role"
        value={customer.role}
        onChange={async (role) => {
          if (role === customer.role) return;
          const ok = await confirm({
            title: `Make ${customer.name} ${ROLE[role].label.toLowerCase()}?`,
            description:
              role === "admin" ? "Admins have every permission, including roles, promotions, the audit log and system tools." : role === "staff" ? "Staff can manage catalogue, inventory, orders and reviews, and view customers." : "They lose access to the admin console.",
            confirmLabel: "Change role",
            variant: role === "customer" ? "danger" : "primary",
            typeToConfirm: role === "admin" ? customer.email : undefined,
          });
          if (ok) onChange(role);
        }}
        options={[
          { value: "customer", label: "Customer", hint: "No console access" },
          { value: "staff", label: "Staff" },
          { value: "admin", label: "Admin" },
        ]}
      />
    </Card>
  );
}
