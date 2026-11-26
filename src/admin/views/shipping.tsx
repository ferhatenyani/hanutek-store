"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Plus, Trash2, Truck } from "lucide-react";
import type { OrderStatus } from "@/lib/api-types";
import { ApiError, adminApi, errorMessage, invalidate, useApi, withQuery } from "../lib/client";
import { ago, dzd, num, wilayaName } from "../lib/format";
import { ORDER_STATUS, TRANSITION_VERB } from "../lib/meta";
import type { Carrier, OrderRow, Paged } from "../lib/types";
import { DataTable, type Column } from "../data/table";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Mono, PageHeader, Skeleton, Switch, Textarea } from "../ui/core";
import { Dialog, Drawer, Select, useConfirm, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";

const LANES: { key: string; title: string; status: string; next?: OrderStatus; hint: string }[] = [
  { key: "confirm", title: "À confirmer", status: "pending", next: "confirmed", hint: "Appeler le client pour confirmer" },
  { key: "pack", title: "À préparer", status: "confirmed", next: "packed", hint: "Préparer le colis" },
  { key: "ship", title: "À expédier", status: "packed", next: "shipped", hint: "Remettre au transporteur" },
  { key: "transit", title: "En transit", status: "shipped,out_for_delivery", next: "delivered", hint: "Paiement à encaisser" },
];

export function ShippingPage() {
  const { can } = useSession();
  const carriers = useApi<{ items: Carrier[] }>("/admin/carriers");
  const [ship, setShip] = useState<OrderRow | null>(null);
  return (
    <>
      <PageHeader title="Expéditions" description="Faites avancer les commandes de la confirmation à la livraison, et gérez les transporteurs." />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {LANES.map((l) => (
          <Lane key={l.key} lane={l} writable={can("orders:write")} onShip={setShip} />
        ))}
      </div>
      <Carriers carriers={carriers.data?.items} loading={carriers.loading} error={carriers.error} reload={carriers.reload} manage={can("settings:manage")} />
      {ship && <ShipDialog order={ship} carriers={carriers.data?.items ?? []} onClose={() => setShip(null)} />}
    </>
  );
}

function Lane({ lane, writable, onShip }: { lane: (typeof LANES)[number]; writable: boolean; onShip: (o: OrderRow) => void }) {
  const toast = useToast();
  const q = useApi<Paged<OrderRow>>(withQuery("/admin/orders", { status: lane.status, sort: "placed", dir: "asc", pageSize: 8 }));
  const [busy, setBusy] = useState<string | null>(null);
  const advance = async (o: OrderRow) => {
    if (lane.next === "shipped") return onShip(o);
    setBusy(o.number);
    try {
      await adminApi(`/admin/orders/${o.number}/status`, { method: "POST", body: { status: lane.next } });
      invalidate("/admin/orders", "/admin/analytics");
      toast.success(`${o.number} · ${ORDER_STATUS[lane.next!].label.toLowerCase()}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION") {
        toast.error("Déjà traitée par quelqu’un d’autre", "Le tableau a été actualisé.");
        invalidate("/admin/orders");
      } else toast.error("Mise à jour impossible", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const total = q.data?.total;
  return (
    <Card padded={false} className="flex min-h-[200px] flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-ad-border px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {lane.title}
            <span className="tnum rounded-full bg-ad-subtle px-1.5 text-[11px] font-medium text-ad-muted">{total ?? "…"}</span>
          </h2>
          <p className="mt-0.5 text-xs text-ad-muted">{lane.hint}</p>
        </div>
        <Link href={`/admin/orders?status=${encodeURIComponent(lane.status)}`} className="text-xs text-ad-muted hover:text-ad-fg">
          Tout voir
        </Link>
      </div>
      <ul className="flex-1 divide-y divide-ad-border">
        {q.loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </li>
          ))}
        {q.data?.items.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-ad-muted">Rien à traiter</li>}
        {q.data?.items.map((o) => (
          <li key={o.number} className="flex items-center gap-3 px-4 py-2.5">
            <Link href={`/admin/orders/${o.number}`} className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[13px]">
                <Mono className="font-medium">{o.number}</Mono>
                <span className="truncate text-ad-muted">{o.customer.name}</span>
              </span>
              <span className="block truncate text-xs text-ad-faint">
                {wilayaName(o.wilaya)} · {dzd(o.total)} · {o.carrier ? `${o.carrier} · ` : ""}
                {ago(o.placedAt)}
              </span>
            </Link>
            {writable && lane.next && (
              <Button size="xs" loading={busy === o.number} onClick={() => advance(o)}>
                {lane.next === "delivered" ? "Livrée" : TRANSITION_VERB[lane.next]}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ShipDialog({ order, carriers, onClose }: { order: OrderRow; carriers: Carrier[]; onClose: () => void }) {
  const toast = useToast();
  const active = carriers.filter((c) => c.isActive);
  const [carrier, setCarrier] = useState(order.carrier ?? active[0]?.name ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [pending, setPending] = useState(false);
  const submit = async () => {
    if (!carrier) return toast.error("Choisissez un transporteur");
    setPending(true);
    try {
      await adminApi(`/admin/orders/${order.number}/status`, { method: "POST", body: { status: "shipped", carrier, trackingNumber: tracking.trim() || null } });
      invalidate("/admin/orders", "/admin/analytics", "/admin/carriers");
      toast.success(`${order.number} expédiée avec ${carrier}`);
      onClose();
    } catch (err) {
      toast.error("Expédition impossible", errorMessage(err));
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Expédier ${order.number}`}
      description={`${order.customer.name} · ${wilayaName(order.wilaya)} · ${dzd(order.total)} à encaisser`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={pending} onClick={submit}>
            Expédier la commande
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Transporteur" htmlFor="ship-carrier">
          <Select id="ship-carrier" value={carrier} onChange={setCarrier} placeholder="Choisir un transporteur" options={active.map((c) => ({ value: c.name, label: c.name }))} />
        </Field>
        <Field label="Numéro de suivi" optional htmlFor="ship-tracking">
          <Input id="ship-tracking" value={tracking} maxLength={80} onChange={(e) => setTracking(e.target.value)} data-autofocus />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function Carriers({ carriers, loading, error, reload, manage }: { carriers?: Carrier[]; loading: boolean; error: unknown; reload: () => void; manage: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Carrier | "new" | null>(null);
  const patch = async (c: Carrier, body: Partial<Carrier>) => {
    try {
      await adminApi(`/admin/carriers/${c.id}`, { method: "PATCH", body });
      invalidate("/admin/carriers");
    } catch (err) {
      toast.error("Mise à jour impossible", errorMessage(err));
    }
  };
  const columns: Column<Carrier>[] = [
    {
      id: "name",
      header: "Transporteur",
      primary: true,
      cell: (c) => (
        <span className="min-w-0">
          <span className="block font-medium">{c.name}</span>
          <span className="block truncate text-xs text-ad-muted">{c.phone ?? c.note ?? "—"}</span>
        </span>
      ),
    },
    { id: "tracking", header: "Lien de suivi", cell: (c) => (c.trackingUrl ? <Mono className="block max-w-[260px] truncate text-ad-muted">{c.trackingUrl}</Mono> : <span className="text-ad-faint">Non défini</span>) },
    { id: "transit", header: "En transit", align: "end", mobile: true, width: "100px", cell: (c) => num(c.inTransit) },
    { id: "delivered", header: "Livrées", align: "end", width: "100px", cell: (c) => num(c.delivered) },
    {
      id: "returnRate",
      header: "Taux de retour",
      align: "end",
      width: "110px",
      cell: (c) => (c.delivered + c.returned ? <span className={c.returned / (c.delivered + c.returned) > 0.1 ? "text-ad-amber" : "text-ad-muted"}>{((c.returned / (c.delivered + c.returned)) * 100).toFixed(1).replace(".", ",")} %</span> : <span className="text-ad-faint">—</span>),
    },
    {
      id: "active",
      header: "Actif",
      align: "end",
      width: "80px",
      mobile: true,
      cell: (c) =>
        manage ? (
          <span data-no-row-click className="inline-flex">
            <Switch checked={c.isActive} onChange={(v) => void patch(c, { isActive: v })} id={`carrier-${c.id}`} ariaLabel={`Actif : ${c.name}`} />
          </span>
        ) : c.isActive ? (
          <Badge tone="green">Actif</Badge>
        ) : (
          <Badge>Inactif</Badge>
        ),
    },
  ];
  return (
    <Card padded={false} className="mt-6">
      <div className="px-4 pt-4 sm:px-5">
        <CardHeader
          className="mb-3"
          title="Transporteurs"
          description="Proposés lors de l’expédition d’une commande. Les commandes gardent le nom du transporteur : une modification ne réécrit jamais l’historique."
          actions={
            manage && (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus size={14} /> Ajouter un transporteur
              </Button>
            )
          }
        />
      </div>
      <DataTable
        label="Transporteurs"
        rows={carriers}
        rowId={(c) => c.id}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={reload}
        onRowClick={manage ? (c) => setEditing(c) : undefined}
        rowActions={
          manage
            ? (c) => [
                { label: "Modifier", icon: <Pencil size={14} />, onSelect: () => setEditing(c) },
                ...(c.trackingUrl ? [{ label: "Ouvrir le site de suivi", icon: <ExternalLink size={14} />, onSelect: () => window.open(c.trackingUrl!.replace("{number}", ""), "_blank", "noopener") }] : []),
                { type: "separator" as const },
                {
                  label: "Supprimer",
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onSelect: async () => {
                    if (!(await confirm({ title: `Supprimer ${c.name} ?`, description: "Les commandes existantes gardent le nom du transporteur. Vous pouvez aussi simplement le désactiver.", confirmLabel: "Supprimer", variant: "danger" }))) return;
                    try {
                      await adminApi(`/admin/carriers/${c.id}`, { method: "DELETE" });
                      invalidate("/admin/carriers");
                      toast.success("Transporteur supprimé");
                    } catch (err) {
                      toast.error("Suppression impossible", errorMessage(err));
                    }
                  },
                },
              ]
            : undefined
        }
        empty={<EmptyState icon={<Truck size={18} />} title="Aucun transporteur pour le moment" description="Ajoutez les sociétés de livraison avec lesquelles vous travaillez." />}
      />
      {editing && <CarrierDrawer carrier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function CarrierDrawer({ carrier, onClose }: { carrier: Carrier | null; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: carrier?.name ?? "", trackingUrl: carrier?.trackingUrl ?? "", phone: carrier?.phone ?? "", note: carrier?.note ?? "", position: String(carrier?.position ?? 0), isActive: carrier?.isActive ?? true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Obligatoire";
    if (f.trackingUrl && !/^https?:\/\/\S+$/i.test(f.trackingUrl.trim())) e.trackingUrl = "Doit commencer par https://";
    setErrors(e);
    if (Object.keys(e).length) return;
    setPending(true);
    try {
      const body = { name: f.name.trim(), trackingUrl: f.trackingUrl.trim() || null, phone: f.phone.trim() || null, note: f.note.trim() || null, position: Number(f.position) || 0, isActive: f.isActive };
      await adminApi(carrier ? `/admin/carriers/${carrier.id}` : "/admin/carriers", { method: carrier ? "PATCH" : "POST", body });
      invalidate("/admin/carriers");
      toast.success(carrier ? "Transporteur enregistré" : "Transporteur ajouté");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={carrier ? `Modifier ${carrier.name}` : "Ajouter un transporteur"}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={pending} onClick={save}>
            {carrier ? "Enregistrer" : "Ajouter le transporteur"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Nom" htmlFor="cr-name" error={errors.name}>
          <Input id="cr-name" value={f.name} maxLength={60} invalid={Boolean(errors.name)} onChange={(e) => setF({ ...f, name: e.target.value })} data-autofocus />
        </Field>
        <Field label="Lien de suivi" optional htmlFor="cr-url" error={errors.trackingUrl} hint="Utilisez {number} à l’endroit du numéro de suivi.">
          <Input id="cr-url" value={f.trackingUrl} maxLength={500} invalid={Boolean(errors.trackingUrl)} placeholder="https://transporteur.exemple/suivi/{number}" onChange={(e) => setF({ ...f, trackingUrl: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Téléphone du support" optional htmlFor="cr-phone">
            <Input id="cr-phone" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Position" htmlFor="cr-pos">
            <Input id="cr-pos" inputMode="numeric" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          </Field>
        </div>
        <Field label="Note" optional htmlFor="cr-note">
          <Textarea id="cr-note" rows={2} value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="ex. Enlèvement en semaine à 14 h" />
        </Field>
        <Switch checked={f.isActive} onChange={(isActive) => setF({ ...f, isActive })} label="Actif" description="Un transporteur inactif n’est pas proposé lors de l’expédition." />
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
