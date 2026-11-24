"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, MoreHorizontal, Phone } from "lucide-react";
import type { OrderStatus } from "@/lib/api-types";
import { ApiError, adminApi, errorMessage, invalidate, useApi } from "../lib/client";
import { dzd, fmtFull, wilayaName } from "../lib/format";
import { ORDER_STATUS, PAYMENT_STATUS, TRANSITION_VERB } from "../lib/meta";
import type { Carrier, OrderDetail } from "../lib/types";
import { Badge, Button, Card, CardHeader, Details, ErrorState, Field, Input, Mono, PageHeader, Separator, Skeleton, Textarea, Thumb } from "../ui/core";
import { Dialog, Menu, Select, useToast } from "../ui/overlay";
import { useSession } from "../shell/session";

const DESTRUCTIVE: OrderStatus[] = ["cancelled", "returned"];

export function OrderDetailPage({ number }: { number: string }) {
  const { can } = useSession();
  const toast = useToast();
  const key = `/admin/orders/${encodeURIComponent(number)}`;
  const q = useApi<{ order: OrderDetail }>(key);
  const carriers = useApi<{ items: Carrier[] }>("/admin/carriers");
  const o = q.data?.order;
  const [transition, setTransition] = useState<OrderStatus | null>(null);

  if (q.error && !o) {
    return (
      <>
        <PageHeader title={number} back={{ href: "/admin/orders", label: "Orders" }} />
        <Card>
          <ErrorState error={q.error} onRetry={q.reload} />
        </Card>
      </>
    );
  }
  if (!o) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const writable = can("orders:write");
  const forward = o.allowedTransitions.filter((s) => !DESTRUCTIVE.includes(s));
  const backward = o.allowedTransitions.filter((s) => DESTRUCTIVE.includes(s));
  const refresh = () => invalidate(key, "/admin/orders", "/admin/analytics", "/admin/inventory");

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={<Mono className="text-xl sm:text-[22px]">{o.number}</Mono>}
        meta={
          <>
            <Badge tone={ORDER_STATUS[o.status].tone} dot>
              {ORDER_STATUS[o.status].label}
            </Badge>
            <Badge tone={PAYMENT_STATUS[o.paymentStatus].tone}>{PAYMENT_STATUS[o.paymentStatus].label}</Badge>
          </>
        }
        description={`Placed ${fmtFull(o.placedAt)} · Cash on delivery · ${o.locale === "ar" ? "Arabic" : "French"} storefront`}
        actions={
          <>
            {writable &&
              forward.map((s, i) => (
                <Button key={s} variant={i === 0 ? "primary" : "secondary"} onClick={() => setTransition(s)}>
                  {TRANSITION_VERB[s]}
                </Button>
              ))}
            <Menu
              label="More actions"
              items={[
                { label: "Copy order number", icon: <Copy size={14} />, onSelect: () => void navigator.clipboard?.writeText(o.number).then(() => toast("Copied")) },
                { label: "Open customer view", icon: <ExternalLink size={14} />, onSelect: () => window.open(`/order/${o.number}`, "_blank", "noopener") },
                ...(writable && backward.length
                  ? [{ type: "separator" as const }, ...backward.map((s) => ({ label: TRANSITION_VERB[s], danger: true, onSelect: () => setTransition(s) }))]
                  : []),
              ]}
              trigger={(p) => (
                <Button {...p} icon aria-label="More actions">
                  <MoreHorizontal size={16} />
                </Button>
              )}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card padded={false}>
            <div className="px-4 pt-4 sm:px-5">
              <h2 className="text-sm font-semibold">Items</h2>
            </div>
            <ul className="mt-2 divide-y divide-ad-border">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Thumb src={it.image} size={44} />
                  <div className="min-w-0 flex-1">
                    {it.productId && can("catalog:read") ? (
                      <Link href={`/admin/products/${it.productId}`} className="block truncate text-[13px] font-medium hover:underline">
                        {it.name}
                      </Link>
                    ) : (
                      <p className="truncate text-[13px] font-medium">{it.name}</p>
                    )}
                    <p className="truncate text-xs text-ad-muted">
                      {it.variant.fr} · <Mono className="text-[11.5px]">{it.sku}</Mono>
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-[13px] text-ad-muted">
                    {dzd(it.unitPrice)} × {it.qty}
                  </span>
                  <span className="tnum w-24 shrink-0 text-end text-[13px] font-medium">{dzd(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <Separator />
            <Totals order={o} writable={writable} onSaved={refresh} orderKey={key} />
          </Card>

          <Card>
            <CardHeader title="Timeline" description="Status changes, newest last" />
            <ol className="relative space-y-4">
              {o.events.map((e, i) => (
                <li key={i} className="relative flex gap-3">
                  <span aria-hidden className="relative flex flex-col items-center pt-1">
                    <span className={`size-2.5 rounded-full border-2 ${i === o.events.length - 1 ? "border-ad-fg bg-ad-fg" : "border-ad-border-strong bg-ad-panel"}`} />
                    {i < o.events.length - 1 && <span className="absolute top-4 h-[calc(100%+6px)] w-px bg-ad-border" />}
                  </span>
                  <div className="min-w-0 flex-1 text-[13px]">
                    <p className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{ORDER_STATUS[e.status].label}</span>
                      <span className="text-xs text-ad-faint">{fmtFull(e.at)}</span>
                    </p>
                    <p className="text-xs text-ad-muted">{e.actorName ? `by ${e.actorName}${e.actorRole && e.actorRole !== "customer" ? "" : " (customer)"}` : e.status === "pending" ? "Placed on the store" : "System"}</p>
                    {e.note && <p className="mt-1 rounded-md bg-ad-subtle px-2.5 py-1.5 text-[13px] text-ad-fg">{e.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-3 text-[13px]">
              <div>
                <p className="font-medium">{o.address.fullName}</p>
                <a href={`tel:${o.address.phone}`} className="mt-0.5 inline-flex items-center gap-1.5 text-ad-muted hover:text-ad-fg">
                  <Phone size={13} /> {o.address.phone}
                </a>
                {o.address.email && <p className="truncate text-ad-muted">{o.address.email}</p>}
              </div>
              {o.account ? (
                <p className="text-ad-muted">
                  {can("customers:read") ? (
                    <Link href={`/admin/customers/${o.account.id}`} className="text-ad-fg underline-offset-2 hover:underline">
                      Account · {o.account.orderCount} order{o.account.orderCount === 1 ? "" : "s"}
                    </Link>
                  ) : (
                    `Account · ${o.account.orderCount} orders`
                  )}
                </p>
              ) : (
                <Badge>Guest checkout</Badge>
              )}
              <Separator />
              <div>
                <p className="mb-1 text-xs font-medium text-ad-muted">Ship to</p>
                <p>{o.address.line1}</p>
                <p>
                  {o.address.commune}
                  {o.address.postalCode ? `, ${o.address.postalCode}` : ""}
                </p>
                <p>{wilayaName(o.address.wilaya)}</p>
              </div>
              {o.customerNote && (
                <div>
                  <p className="mb-1 text-xs font-medium text-ad-muted">Customer note</p>
                  <p className="rounded-md bg-ad-subtle px-2.5 py-1.5">{o.customerNote}</p>
                </div>
              )}
            </div>
          </Card>
          <Delivery order={o} carriers={carriers.data?.items ?? []} writable={writable} onSaved={refresh} />
          <InternalNote order={o} writable={writable} onSaved={refresh} />
        </div>
      </div>

      {transition && (
        <TransitionDialog
          order={o}
          to={transition}
          carriers={carriers.data?.items ?? []}
          onClose={() => setTransition(null)}
          onDone={(msg) => {
            setTransition(null);
            toast.success(msg);
            refresh();
          }}
          onStale={() => {
            setTransition(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function Totals({ order: o, writable, onSaved, orderKey }: { order: OrderDetail; writable: boolean; onSaved: () => void; orderKey: string }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [fee, setFee] = useState(String(o.shippingFee));
  const [pending, setPending] = useState(false);
  const closed = ["delivered", "cancelled", "returned"].includes(o.status);
  const save = async () => {
    const v = Number(fee);
    if (!Number.isInteger(v) || v < 0) return toast.error("Enter a whole amount in DA");
    setPending(true);
    try {
      await adminApi(orderKey, { method: "PATCH", body: { shippingFee: v } });
      toast.success("Delivery fee updated");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error("Couldn't update the fee", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <dl className="space-y-2 px-4 py-4 text-[13px] sm:px-5">
      <Row label="Subtotal" value={dzd(o.subtotal)} />
      {o.discount > 0 && <Row label={<>Discount {o.promoCode && <Mono className="ms-1 text-ad-muted">{o.promoCode}</Mono>}</>} value={`− ${dzd(o.discount)}`} />}
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ad-muted">Delivery fee</dt>
        <dd className="flex items-center gap-2">
          {editing ? (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <Input inputSize="sm" aria-label="Delivery fee" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} suffix="DA" className="w-28" autoFocus />
              <Button size="sm" type="submit" variant="primary" loading={pending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <span className="tnum">{dzd(o.shippingFee)}</span>
              {writable && !closed && (
                <Button size="xs" variant="ghost" onClick={() => (setFee(String(o.shippingFee)), setEditing(true))}>
                  Edit
                </Button>
              )}
            </>
          )}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-ad-border pt-2 text-sm font-semibold">
        <dt>Total</dt>
        <dd className="tnum">{dzd(o.total)}</dd>
      </div>
      <p className="text-xs text-ad-faint">{o.paymentStatus === "paid" ? "Cash collected on delivery." : o.paymentStatus === "refunded" ? "Refunded after return." : "To collect on delivery."}</p>
    </dl>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ad-muted">{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}

export const trackingLink = (carriers: Carrier[], name: string | null, number: string | null) => {
  const c = carriers.find((x) => x.name.toLowerCase() === (name ?? "").toLowerCase());
  if (!c?.trackingUrl || !number) return null;
  return c.trackingUrl.includes("{number}") ? c.trackingUrl.replace("{number}", encodeURIComponent(number)) : c.trackingUrl;
};

function CarrierSelect({ value, onChange, carriers, id }: { value: string; onChange: (v: string) => void; carriers: Carrier[]; id?: string }) {
  const names = carriers.filter((c) => c.isActive || c.name === value).map((c) => c.name);
  if (value && !names.includes(value)) names.push(value);
  return <Select id={id} ariaLabel="Carrier" value={value} onChange={onChange} placeholder="Choose a carrier" options={[{ value: "", label: "None", text: "None" }, ...names.map((n) => ({ value: n, label: n }))]} />;
}

function Delivery({ order: o, carriers, writable, onSaved }: { order: OrderDetail; carriers: Carrier[]; writable: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [carrier, setCarrier] = useState(o.carrier ?? "");
  const [tracking, setTracking] = useState(o.trackingNumber ?? "");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect server updates
    setCarrier(o.carrier ?? "");
    setTracking(o.trackingNumber ?? "");
  }, [o.carrier, o.trackingNumber]);
  const dirty = carrier !== (o.carrier ?? "") || tracking !== (o.trackingNumber ?? "");
  const link = trackingLink(carriers, o.carrier, o.trackingNumber);
  const save = async () => {
    setPending(true);
    try {
      await adminApi(`/admin/orders/${o.number}`, { method: "PATCH", body: { carrier: carrier || null, trackingNumber: tracking.trim() || null } });
      toast.success("Delivery details saved");
      onSaved();
    } catch (err) {
      toast.error("Couldn't save", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Delivery" />
      {writable ? (
        <div className="space-y-3">
          <Field label="Carrier" htmlFor="carrier">
            <CarrierSelect id="carrier" value={carrier} onChange={setCarrier} carriers={carriers} />
          </Field>
          <Field label="Tracking number" htmlFor="tracking">
            <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} placeholder="e.g. YAL-123456" />
          </Field>
          <div className="flex items-center justify-between gap-2">
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-ad-muted hover:text-ad-fg">
                Track parcel <ExternalLink size={12} />
              </a>
            ) : (
              <span />
            )}
            <Button size="sm" variant="primary" disabled={!dirty} loading={pending} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <Details items={[{ label: "Carrier", value: o.carrier ?? "—" }, { label: "Tracking", value: o.trackingNumber ?? "—" }]} />
      )}
    </Card>
  );
}

function InternalNote({ order: o, writable, onSaved }: { order: OrderDetail; writable: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState(o.internalNote ?? "");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect server updates
    setNote(o.internalNote ?? "");
  }, [o.internalNote]);
  const dirty = note !== (o.internalNote ?? "");
  return (
    <Card>
      <CardHeader title="Internal note" description="Only visible to staff." />
      {writable ? (
        <div className="space-y-2">
          <Textarea aria-label="Internal note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="Add context for the team…" />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!dirty}
              loading={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await adminApi(`/admin/orders/${o.number}`, { method: "PATCH", body: { internalNote: note.trim() || null } });
                  toast.success("Note saved");
                  onSaved();
                } catch (err) {
                  toast.error("Couldn't save the note", errorMessage(err));
                } finally {
                  setPending(false);
                }
              }}
            >
              Save note
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-ad-muted">{o.internalNote || "No note."}</p>
      )}
    </Card>
  );
}

function TransitionDialog({
  order: o,
  to,
  carriers,
  onClose,
  onDone,
  onStale,
}: {
  order: OrderDetail;
  to: OrderStatus;
  carriers: Carrier[];
  onClose: () => void;
  onDone: (msg: string) => void;
  onStale: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState(o.carrier ?? carriers.find((c) => c.isActive)?.name ?? "");
  const [tracking, setTracking] = useState(o.trackingNumber ?? "");
  const [pending, setPending] = useState(false);
  const shipping = to === "shipped";
  const danger = DESTRUCTIVE.includes(to);
  const submit = async () => {
    if (shipping && !carrier) return toast.error("Choose a carrier before shipping");
    setPending(true);
    try {
      await adminApi(`/admin/orders/${o.number}/status`, {
        method: "POST",
        body: { status: to, note: note.trim() || null, ...(shipping ? { carrier, trackingNumber: tracking.trim() || null } : {}) },
      });
      onDone(`Order ${ORDER_STATUS[to].label.toLowerCase()}`);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION") {
        toast.error("This order changed in the meantime", "It was reloaded with its current status.");
        return onStale();
      }
      toast.error("Couldn't update the order", errorMessage(err));
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${TRANSITION_VERB[to]} · ${o.number}`}
      description={ORDER_STATUS[to].hint}
      footer={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button variant={danger ? "danger" : "primary"} loading={pending} onClick={submit}>
            {TRANSITION_VERB[to]}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {danger && (
          <p className="rounded-md bg-ad-amber-soft px-3 py-2 text-[13px] text-ad-amber">
            {to === "cancelled" ? "Items go back into stock and the promo code use is released." : "Items go back into stock. A paid order is marked refunded."}
          </p>
        )}
        {to === "delivered" && <p className="rounded-md bg-ad-subtle px-3 py-2 text-[13px] text-ad-muted">Marks {dzd(o.total)} as collected (cash on delivery).</p>}
        {shipping && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Carrier" htmlFor="t-carrier">
              <CarrierSelect id="t-carrier" value={carrier} onChange={setCarrier} carriers={carriers} />
            </Field>
            <Field label="Tracking number" htmlFor="t-tracking" optional>
              <Input id="t-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} />
            </Field>
          </div>
        )}
        <Field label="Note" optional hint="Shown on the order timeline.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} data-autofocus={!shipping || undefined} />
        </Field>
      </form>
    </Dialog>
  );
}
