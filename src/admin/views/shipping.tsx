"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Plus, Trash2, Truck } from "lucide-react";
import type { OrderStatus } from "@/lib/api-types";
import { ApiError, adminApi, errorMessage, invalidate, useApi, withQuery } from "../lib/client";
import { ago, dzd, num, wilayaName } from "../lib/format";
import { TRANSITION_VERB } from "../lib/meta";
import type { Carrier, OrderRow, Paged } from "../lib/types";
import { DataTable, type Column } from "../data/table";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Mono, PageHeader, Skeleton, Switch, Textarea } from "../ui/core";
import { Dialog, Drawer, Select, useConfirm, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";

const LANES: { key: string; title: string; status: string; next?: OrderStatus; hint: string }[] = [
  { key: "confirm", title: "To confirm", status: "pending", next: "confirmed", hint: "Call the customer to confirm" },
  { key: "pack", title: "To pack", status: "confirmed", next: "packed", hint: "Prepare the parcel" },
  { key: "ship", title: "To ship", status: "packed", next: "shipped", hint: "Hand over to a carrier" },
  { key: "transit", title: "In transit", status: "shipped,out_for_delivery", next: "delivered", hint: "Cash to collect" },
];

export function ShippingPage() {
  const { can } = useSession();
  const carriers = useApi<{ items: Carrier[] }>("/admin/carriers");
  const [ship, setShip] = useState<OrderRow | null>(null);
  return (
    <>
      <PageHeader title="Shipping" description="Move orders from confirmation to delivery, and manage delivery carriers." />
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
      toast.success(`${o.number} · ${TRANSITION_VERB[lane.next!].toLowerCase()}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION") {
        toast.error("Already moved by someone else", "The board was refreshed.");
        invalidate("/admin/orders");
      } else toast.error("Couldn't update", errorMessage(err));
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
          View all
        </Link>
      </div>
      <ul className="flex-1 divide-y divide-ad-border">
        {q.loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </li>
          ))}
        {q.data?.items.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-ad-muted">All clear</li>}
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
                {lane.next === "delivered" ? "Delivered" : TRANSITION_VERB[lane.next]}
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
    if (!carrier) return toast.error("Choose a carrier");
    setPending(true);
    try {
      await adminApi(`/admin/orders/${order.number}/status`, { method: "POST", body: { status: "shipped", carrier, trackingNumber: tracking.trim() || null } });
      invalidate("/admin/orders", "/admin/analytics", "/admin/carriers");
      toast.success(`${order.number} shipped with ${carrier}`);
      onClose();
    } catch (err) {
      toast.error("Couldn't ship", errorMessage(err));
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Ship ${order.number}`}
      description={`${order.customer.name} · ${wilayaName(order.wilaya)} · ${dzd(order.total)} to collect`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={pending} onClick={submit}>
            Ship order
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
        <Field label="Carrier" htmlFor="ship-carrier">
          <Select id="ship-carrier" value={carrier} onChange={setCarrier} placeholder="Choose a carrier" options={active.map((c) => ({ value: c.name, label: c.name }))} />
        </Field>
        <Field label="Tracking number" optional htmlFor="ship-tracking">
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
      toast.error("Couldn't update", errorMessage(err));
    }
  };
  const columns: Column<Carrier>[] = [
    {
      id: "name",
      header: "Carrier",
      primary: true,
      cell: (c) => (
        <span className="min-w-0">
          <span className="block font-medium">{c.name}</span>
          <span className="block truncate text-xs text-ad-muted">{c.phone ?? c.note ?? "—"}</span>
        </span>
      ),
    },
    { id: "tracking", header: "Tracking link", cell: (c) => (c.trackingUrl ? <Mono className="block max-w-[260px] truncate text-ad-muted">{c.trackingUrl}</Mono> : <span className="text-ad-faint">Not set</span>) },
    { id: "transit", header: "In transit", align: "end", mobile: true, width: "100px", cell: (c) => num(c.inTransit) },
    { id: "delivered", header: "Delivered", align: "end", width: "100px", cell: (c) => num(c.delivered) },
    {
      id: "returnRate",
      header: "Return rate",
      align: "end",
      width: "110px",
      cell: (c) => (c.delivered + c.returned ? <span className={c.returned / (c.delivered + c.returned) > 0.1 ? "text-ad-amber" : "text-ad-muted"}>{((c.returned / (c.delivered + c.returned)) * 100).toFixed(1)}%</span> : <span className="text-ad-faint">—</span>),
    },
    {
      id: "active",
      header: "Active",
      align: "end",
      width: "80px",
      mobile: true,
      cell: (c) =>
        manage ? (
          <span data-no-row-click className="inline-flex">
            <Switch checked={c.isActive} onChange={(v) => void patch(c, { isActive: v })} id={`carrier-${c.id}`} ariaLabel={`Active: ${c.name}`} />
          </span>
        ) : c.isActive ? (
          <Badge tone="green">Active</Badge>
        ) : (
          <Badge>Off</Badge>
        ),
    },
  ];
  return (
    <Card padded={false} className="mt-6">
      <div className="px-4 pt-4 sm:px-5">
        <CardHeader
          className="mb-3"
          title="Carriers"
          description="Shown when shipping an order. Orders keep the carrier name, so edits never rewrite history."
          actions={
            manage && (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus size={14} /> Add carrier
              </Button>
            )
          }
        />
      </div>
      <DataTable
        label="Carriers"
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
                { label: "Edit", icon: <Pencil size={14} />, onSelect: () => setEditing(c) },
                ...(c.trackingUrl ? [{ label: "Open tracking site", icon: <ExternalLink size={14} />, onSelect: () => window.open(c.trackingUrl!.replace("{number}", ""), "_blank", "noopener") }] : []),
                { type: "separator" as const },
                {
                  label: "Delete",
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onSelect: async () => {
                    if (!(await confirm({ title: `Delete ${c.name}?`, description: "Existing orders keep the carrier name. You can also just deactivate it.", confirmLabel: "Delete", variant: "danger" }))) return;
                    try {
                      await adminApi(`/admin/carriers/${c.id}`, { method: "DELETE" });
                      invalidate("/admin/carriers");
                      toast.success("Carrier deleted");
                    } catch (err) {
                      toast.error("Couldn't delete", errorMessage(err));
                    }
                  },
                },
              ]
            : undefined
        }
        empty={<EmptyState icon={<Truck size={18} />} title="No carriers yet" description="Add the delivery companies you work with." />}
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
    if (!f.name.trim()) e.name = "Required";
    if (f.trackingUrl && !/^https?:\/\/\S+$/i.test(f.trackingUrl.trim())) e.trackingUrl = "Must start with https://";
    setErrors(e);
    if (Object.keys(e).length) return;
    setPending(true);
    try {
      const body = { name: f.name.trim(), trackingUrl: f.trackingUrl.trim() || null, phone: f.phone.trim() || null, note: f.note.trim() || null, position: Number(f.position) || 0, isActive: f.isActive };
      await adminApi(carrier ? `/admin/carriers/${carrier.id}` : "/admin/carriers", { method: carrier ? "PATCH" : "POST", body });
      invalidate("/admin/carriers");
      toast.success(carrier ? "Carrier saved" : "Carrier added");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error("Couldn't save", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={carrier ? `Edit ${carrier.name}` : "Add carrier"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={pending} onClick={save}>
            {carrier ? "Save" : "Add carrier"}
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
        <Field label="Name" htmlFor="cr-name" error={errors.name}>
          <Input id="cr-name" value={f.name} maxLength={60} invalid={Boolean(errors.name)} onChange={(e) => setF({ ...f, name: e.target.value })} data-autofocus />
        </Field>
        <Field label="Tracking link" optional htmlFor="cr-url" error={errors.trackingUrl} hint="Use {number} where the tracking number goes.">
          <Input id="cr-url" value={f.trackingUrl} maxLength={500} invalid={Boolean(errors.trackingUrl)} placeholder="https://carrier.example/track/{number}" onChange={(e) => setF({ ...f, trackingUrl: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Support phone" optional htmlFor="cr-phone">
            <Input id="cr-phone" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Position" htmlFor="cr-pos">
            <Input id="cr-pos" inputMode="numeric" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          </Field>
        </div>
        <Field label="Note" optional htmlFor="cr-note">
          <Textarea id="cr-note" rows={2} value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Pickup every weekday at 14:00" />
        </Field>
        <Switch checked={f.isActive} onChange={(isActive) => setF({ ...f, isActive })} label="Active" description="Inactive carriers are hidden when shipping." />
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
