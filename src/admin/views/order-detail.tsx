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
        <PageHeader title={number} back={{ href: "/admin/orders", label: "Commandes" }} />
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
        back={{ href: "/admin/orders", label: "Commandes" }}
        title={<Mono className="text-xl sm:text-[22px]">{o.number}</Mono>}
        meta={
          <>
            <Badge tone={ORDER_STATUS[o.status].tone} dot>
              {ORDER_STATUS[o.status].label}
            </Badge>
            <Badge tone={PAYMENT_STATUS[o.paymentStatus].tone}>{PAYMENT_STATUS[o.paymentStatus].label}</Badge>
          </>
        }
        description={`Passée le ${fmtFull(o.placedAt)} · Paiement à la livraison · Boutique en ${o.locale === "ar" ? "arabe" : "français"}`}
        actions={
          <>
            {writable &&
              forward.map((s, i) => (
                <Button key={s} variant={i === 0 ? "primary" : "secondary"} onClick={() => setTransition(s)}>
                  {TRANSITION_VERB[s]}
                </Button>
              ))}
            <Menu
              label="Plus d’actions"
              items={[
                { label: "Copier le numéro de commande", icon: <Copy size={14} />, onSelect: () => void navigator.clipboard?.writeText(o.number).then(() => toast("Copié")) },
                { label: "Ouvrir la vue client", icon: <ExternalLink size={14} />, onSelect: () => window.open(`/order/${o.number}`, "_blank", "noopener") },
                ...(writable && backward.length
                  ? [{ type: "separator" as const }, ...backward.map((s) => ({ label: TRANSITION_VERB[s], danger: true, onSelect: () => setTransition(s) }))]
                  : []),
              ]}
              trigger={(p) => (
                <Button {...p} icon aria-label="Plus d’actions">
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
              <h2 className="text-sm font-semibold">Articles</h2>
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
            <CardHeader title="Historique" description="Changements de statut, du plus ancien au plus récent" />
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
                    <p className="text-xs text-ad-muted">{e.actorName ? `par ${e.actorName}${e.actorRole && e.actorRole !== "customer" ? "" : " (client)"}` : e.status === "pending" ? "Passée sur la boutique" : "Système"}</p>
                    {e.note && <p className="mt-1 rounded-md bg-ad-subtle px-2.5 py-1.5 text-[13px] text-ad-fg">{e.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Client" />
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
                      Compte · {o.account.orderCount} commande{o.account.orderCount === 1 ? "" : "s"}
                    </Link>
                  ) : (
                    `Compte · ${o.account.orderCount} commande${o.account.orderCount === 1 ? "" : "s"}`
                  )}
                </p>
              ) : (
                <Badge>Commande invité</Badge>
              )}
              <Separator />
              <div>
                <p className="mb-1 text-xs font-medium text-ad-muted">Livrer à</p>
                <p>{o.address.line1}</p>
                <p>
                  {o.address.commune}
                  {o.address.postalCode ? `, ${o.address.postalCode}` : ""}
                </p>
                <p>{wilayaName(o.address.wilaya)}</p>
              </div>
              {o.customerNote && (
                <div>
                  <p className="mb-1 text-xs font-medium text-ad-muted">Note du client</p>
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
    if (!Number.isInteger(v) || v < 0) return toast.error("Saisissez un montant entier en DA");
    setPending(true);
    try {
      await adminApi(orderKey, { method: "PATCH", body: { shippingFee: v } });
      toast.success("Frais de livraison mis à jour");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error("Impossible de modifier les frais", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <dl className="space-y-2 px-4 py-4 text-[13px] sm:px-5">
      <Row label="Sous-total" value={dzd(o.subtotal)} />
      {o.discount > 0 && <Row label={<>Réduction {o.promoCode && <Mono className="ms-1 text-ad-muted">{o.promoCode}</Mono>}</>} value={`− ${dzd(o.discount)}`} />}
      <div className="flex items-center justify-between gap-3">
        <dt className="text-ad-muted">Frais de livraison</dt>
        <dd className="flex items-center gap-2">
          {editing ? (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <Input inputSize="sm" aria-label="Frais de livraison" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} suffix="DA" className="w-28" autoFocus />
              <Button size="sm" type="submit" variant="primary" loading={pending}>
                Enregistrer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </form>
          ) : (
            <>
              <span className="tnum">{dzd(o.shippingFee)}</span>
              {writable && !closed && (
                <Button size="xs" variant="ghost" onClick={() => (setFee(String(o.shippingFee)), setEditing(true))}>
                  Modifier
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
      <p className="text-xs text-ad-faint">{o.paymentStatus === "paid" ? "Encaissé à la livraison." : o.paymentStatus === "refunded" ? "Remboursé après retour." : "À encaisser à la livraison."}</p>
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
  return <Select id={id} ariaLabel="Transporteur" value={value} onChange={onChange} placeholder="Choisir un transporteur" options={[{ value: "", label: "Aucun", text: "Aucun" }, ...names.map((n) => ({ value: n, label: n }))]} />;
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
      toast.success("Informations de livraison enregistrées");
      onSaved();
    } catch (err) {
      toast.error("Enregistrement impossible", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Livraison" />
      {writable ? (
        <div className="space-y-3">
          <Field label="Transporteur" htmlFor="carrier">
            <CarrierSelect id="carrier" value={carrier} onChange={setCarrier} carriers={carriers} />
          </Field>
          <Field label="Numéro de suivi" htmlFor="tracking">
            <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} placeholder="ex. YAL-123456" />
          </Field>
          <div className="flex items-center justify-between gap-2">
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-ad-muted hover:text-ad-fg">
                Suivre le colis <ExternalLink size={12} />
              </a>
            ) : (
              <span />
            )}
            <Button size="sm" variant="primary" disabled={!dirty} loading={pending} onClick={save}>
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <Details items={[{ label: "Transporteur", value: o.carrier ?? "—" }, { label: "Suivi", value: o.trackingNumber ?? "—" }]} />
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
      <CardHeader title="Note interne" description="Visible uniquement par l’équipe." />
      {writable ? (
        <div className="space-y-2">
          <Textarea aria-label="Note interne" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="Ajoutez du contexte pour l’équipe…" />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!dirty}
              loading={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await adminApi(`/admin/orders/${o.number}`, { method: "PATCH", body: { internalNote: note.trim() || null } });
                  toast.success("Note enregistrée");
                  onSaved();
                } catch (err) {
                  toast.error("Impossible d’enregistrer la note", errorMessage(err));
                } finally {
                  setPending(false);
                }
              }}
            >
              Enregistrer la note
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-ad-muted">{o.internalNote || "Aucune note."}</p>
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
    if (shipping && !carrier) return toast.error("Choisissez un transporteur avant d’expédier");
    setPending(true);
    try {
      await adminApi(`/admin/orders/${o.number}/status`, {
        method: "POST",
        body: { status: to, note: note.trim() || null, ...(shipping ? { carrier, trackingNumber: tracking.trim() || null } : {}) },
      });
      onDone(`Commande ${ORDER_STATUS[to].label.toLowerCase()}`);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION") {
        toast.error("Cette commande a changé entre-temps", "Elle a été rechargée avec son statut actuel.");
        return onStale();
      }
      toast.error("Impossible de mettre à jour la commande", errorMessage(err));
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
          <Button onClick={onClose}>Retour</Button>
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
            {to === "cancelled" ? "Les articles sont réintégrés au stock et l’utilisation du code promo est libérée." : "Les articles sont réintégrés au stock. Une commande payée est marquée remboursée."}
          </p>
        )}
        {to === "delivered" && <p className="rounded-md bg-ad-subtle px-3 py-2 text-[13px] text-ad-muted">Marque {dzd(o.total)} comme encaissé (paiement à la livraison).</p>}
        {shipping && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Transporteur" htmlFor="t-carrier">
              <CarrierSelect id="t-carrier" value={carrier} onChange={setCarrier} carriers={carriers} />
            </Field>
            <Field label="Numéro de suivi" htmlFor="t-tracking" optional>
              <Input id="t-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} />
            </Field>
          </div>
        )}
        <Field label="Note" optional hint="Affichée dans l’historique de la commande.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} data-autofocus={!shipping || undefined} />
        </Field>
      </form>
    </Dialog>
  );
}
