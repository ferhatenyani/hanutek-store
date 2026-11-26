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
        header: "Nom",
        primary: true,
        hideable: false,
        sortKey: "name",
        cell: (c) => (
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={c.name} size={30} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate font-medium">
                {c.name}
                {c.status === "disabled" && <Badge tone="red">Désactivé</Badge>}
              </span>
              <span className="block truncate text-xs text-ad-muted">{c.email}</span>
            </span>
          </span>
        ),
      },
      ...(team ? [{ id: "role", header: "Rôle", mobile: true, width: "110px", cell: (c: CustomerRow) => <Badge tone={ROLE[c.role].tone}>{ROLE[c.role].label}</Badge> }] : []),
      { id: "phone", header: "Téléphone", width: "140px", cell: (c) => <span className="text-ad-muted">{c.phone ?? "—"}</span> },
      { id: "verified", header: "E-mail", width: "110px", defaultHidden: team, cell: (c) => (c.emailVerifiedAt ? <Badge tone="green">Vérifié</Badge> : <Badge>Non vérifié</Badge>) },
      { id: "orders", header: "Commandes", sortKey: "orders", align: "end", mobile: !team, width: "90px", cell: (c) => num(c.orderCount) },
      { id: "spent", header: "Dépensé", sortKey: "spent", align: "end", mobile: !team, width: "130px", cell: (c) => <span className="font-medium">{dzd(c.totalSpent)}</span> },
      { id: "lastOrder", header: "Dernière commande", width: "130px", defaultHidden: team, cell: (c) => <span className="text-ad-muted">{ago(c.lastOrderAt)}</span> },
      { id: "lastLogin", header: "Dernière connexion", sortKey: "lastLogin", width: "130px", defaultHidden: !team, cell: (c) => <span className="text-ad-muted">{ago(c.lastLoginAt)}</span> },
      { id: "created", header: "Inscrit le", sortKey: "created", align: "end", width: "120px", cell: (c) => <span className="text-ad-muted">{fmtDate(c.createdAt)}</span> },
    ],
    [team],
  );
  const cols = useColumns(team ? "team" : "customers", columns);
  const setSearch = useCallback((v: string) => set({ search: v }), [set]);

  return (
    <Card padded={false}>
      <Toolbar>
        <SearchBox value={state.search} onChange={setSearch} placeholder="Nom, e-mail ou téléphone…" label={team ? "Rechercher dans l’équipe" : "Rechercher des clients"} />
        {team && (
          <FilterSelect
            label="Rôle"
            value={state.role as "" | "staff"}
            onChange={(v) => set({ role: v })}
            allLabel="Équipe et administrateurs"
            width="w-[190px]"
            options={[
              { value: "staff", label: "Équipe", text: "Équipe" },
              { value: "admin" as "staff", label: "Administrateur", text: "Administrateur" },
            ]}
          />
        )}
        <FilterSelect
          label="Statut"
          value={state.status as "" | "active"}
          onChange={(v) => set({ status: v })}
          options={[
            { value: "active", label: "Actif", text: "Actif" },
            { value: "disabled" as "active", label: "Désactivé", text: "Désactivé" },
          ]}
        />
        {!team && (
          <FilterSelect
            label="E-mail"
            value={state.verified as "" | "yes"}
            onChange={(v) => set({ verified: v })}
            options={[
              { value: "yes", label: "Vérifié", text: "Vérifié" },
              { value: "no" as "yes", label: "Non vérifié", text: "Non vérifié" },
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
        label={team ? "Membres de l’équipe" : "Clients"}
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
        empty={<EmptyState icon={<Users size={18} />} title="Personne ne correspond" description="Essayez une autre recherche ou un autre filtre." />}
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
        <PageHeader title="Client" back={{ href: "/admin/customers", label: "Clients" }} />
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
      toast.error("Mise à jour impossible", errorMessage(err));
    }
  };
  const toggleStatus = async () => {
    const disabling = c.status === "active";
    if (
      !(await confirm(
        disabling
          ? { title: `Désactiver ${c.name} ?`, description: "Cette personne est déconnectée partout et ne pourra plus se connecter avant réactivation. Ses commandes sont conservées.", confirmLabel: "Désactiver le compte", variant: "danger" }
          : { title: `Réactiver ${c.name} ?`, description: "Cette personne pourra de nouveau se connecter.", confirmLabel: "Réactiver le compte" },
      ))
    )
      return;
    await patch({ status: disabling ? "disabled" : "active" }, disabling ? "Compte désactivé" : "Compte réactivé");
  };
  const signOutAll = async () => {
    if (!(await confirm({ title: "Déconnecter tous les appareils ?", description: `${c.name} devra se reconnecter sur chaque appareil.`, confirmLabel: "Déconnecter partout" }))) return;
    try {
      await adminApi(`${key}/sessions`, { method: "DELETE" });
      invalidate(key);
      toast.success("Déconnecté de tous les appareils");
    } catch (err) {
      toast.error("Déconnexion impossible", errorMessage(err));
    }
  };
  const back = c.role === "customer" ? { href: "/admin/customers", label: "Clients" } : { href: "/admin/team", label: "Équipe et rôles" };

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
            {c.status === "disabled" && <Badge tone="red" dot>Désactivé</Badge>}
            {self && <Badge>Vous</Badge>}
          </>
        }
        description={`Client depuis le ${fmtDate(c.createdAt)} · dernière connexion ${ago(c.lastLoginAt)}`}
        actions={
          canWrite &&
          !self && (
            <Menu
              label="Actions sur le compte"
              items={[
                { label: "Déconnecter partout", icon: <LogOut size={14} />, onSelect: () => void signOutAll() },
                { type: "separator" },
                c.status === "active"
                  ? { label: "Désactiver le compte", icon: <ShieldOff size={14} />, danger: true, onSelect: () => void toggleStatus() }
                  : { label: "Réactiver le compte", icon: <ShieldCheck size={14} />, onSelect: () => void toggleStatus() },
              ]}
              trigger={(p) => <Button {...p}>Gérer le compte</Button>}
            />
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ad-border bg-ad-border shadow-ad lg:grid-cols-4">
        {[
          ["Total dépensé", dzd(c.stats.totalSpent), "Commandes livrées"],
          ["Commandes", num(c.stats.orderCount), `${c.stats.delivered} livrée${c.stats.delivered === 1 ? "" : "s"} · ${c.stats.cancelled} annulée${c.stats.cancelled === 1 ? "" : "s"}`],
          ["Panier moyen", dzd(c.stats.avgOrderValue), "Commandes livrées"],
          ["Dernière commande", c.stats.lastOrderAt ? ago(c.stats.lastOrderAt) : "—", c.stats.firstOrderAt ? `Première le ${fmtDate(c.stats.firstOrderAt)}` : "Aucune commande pour le moment"],
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
              <h2 className="text-sm font-semibold">Commandes</h2>
              {c.orders.length > 0 && can("orders:read") && (
                <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="text-[13px] text-ad-muted hover:text-ad-fg">
                  Ouvrir dans les commandes
                </Link>
              )}
            </div>
            {c.orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ad-muted">Aucune commande pour le moment.</p>
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
            <CardHeader title="Avis" description={`${c.reviews.length} rédigé${c.reviews.length === 1 ? "" : "s"}`} />
            {c.reviews.length === 0 ? (
              <p className="text-[13px] text-ad-muted">Aucun avis.</p>
            ) : (
              <ul className="space-y-3">
                {c.reviews.map((r) => (
                  <li key={r.id} className="rounded-md border border-ad-border p-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-0.5 text-ad-amber" aria-label={`${r.rating} sur 5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < r.rating ? "fill-current" : "opacity-30"} aria-hidden />
                        ))}
                      </span>
                      <Link href={`/admin/products/${r.productId}`} className="font-medium hover:underline">
                        {r.productName}
                      </Link>
                      {r.status === "hidden" && <Badge>Masqué</Badge>}
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
            <CardHeader title="Coordonnées" />
            <ul className="space-y-2 text-[13px]">
              <li className="flex items-center gap-2">
                <Mail size={14} className="shrink-0 text-ad-faint" />
                <a href={`mailto:${c.email}`} className="truncate hover:underline">
                  {c.email}
                </a>
                {c.emailVerifiedAt && <BadgeCheck size={14} className="shrink-0 text-ad-green" aria-label="Vérifié" />}
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="shrink-0 text-ad-faint" />
                {c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : <span className="text-ad-faint">No phone</span>}
              </li>
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-ad-border pt-4 text-[13px]">
              <dt className="text-ad-muted">Langue</dt>
              <dd>{c.locale === "ar" ? "Arabe" : "Français"}</dd>
              <dt className="text-ad-muted">Connexion Google</dt>
              <dd>{c.googleLinked ? "Associée" : "Non"}</dd>
              <dt className="text-ad-muted">Favoris</dt>
              <dd>{c.stats.favorites}</dd>
              <dt className="text-ad-muted">Sessions actives</dt>
              <dd>{c.stats.activeSessions}</dd>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Adresses" />
            {c.addresses.length === 0 ? (
              <p className="text-[13px] text-ad-muted">Aucune adresse enregistrée.</p>
            ) : (
              <ul className="space-y-3 text-[13px]">
                {c.addresses.map((a) => (
                  <li key={a.id}>
                    <p className="flex items-center gap-2 font-medium">
                      {a.fullName} {a.isDefault && <Badge>Par défaut</Badge>}
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
          {can("users:manage_roles") && !self && <RoleCard customer={c} onChange={(role) => patch({ role }, `Rôle modifié : ${ROLE[role].label}`)} />}
          {c.activity.length > 0 && (
            <Card>
              <CardHeader title="Historique du compte" />
              <ul className="space-y-2 text-[13px]">
                {c.activity.map((a) => (
                  <li key={a.id}>
                    <p>
                      {actionLabel(a.action)} <span className="text-ad-muted">par {a.actorName ?? "Système"}</span>
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
      <CardHeader title="Accès" description="Changer le rôle déconnecte la personne de tous ses appareils." />
      <Select
        ariaLabel="Rôle"
        value={customer.role}
        onChange={async (role) => {
          if (role === customer.role) return;
          const ok = await confirm({
            title: `Attribuer le rôle « ${ROLE[role].label.toLowerCase()} » à ${customer.name} ?`,
            description:
              role === "admin" ? "Les administrateurs ont toutes les autorisations, y compris les rôles, les codes promo, le journal d’audit et les outils système." : role === "staff" ? "L’équipe gère le catalogue, le stock, les commandes et les avis, et consulte les clients." : "Cette personne perd l’accès à la console d’administration.",
            confirmLabel: "Changer le rôle",
            variant: role === "customer" ? "danger" : "primary",
            typeToConfirm: role === "admin" ? customer.email : undefined,
          });
          if (ok) onChange(role);
        }}
        options={[
          { value: "customer", label: "Client", hint: "Pas d’accès à la console" },
          { value: "staff", label: "Équipe" },
          { value: "admin", label: "Administrateur" },
        ]}
      />
    </Card>
  );
}
