"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, ChevronRight, Clock, Loader2, MapPin, PackageCheck, PackageX, Truck } from "lucide-react";
import { useStore, guestOrderKey, rememberGuestOrder } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import type { OrderDTO, OrderStage, TrackingStep } from "@/lib/api-types";
import { tr } from "@/lib/catalog-client";
import { stepDetailKey } from "@/lib/order-ui";
import { useI18n } from "@/i18n/provider";
import { WILAYAS } from "@/lib/wilayas";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { NavTransition } from "@/components/nav-transition";

type Row = { step: TrackingStep; at: string | null; state: "done" | "next" | "pending" };

export function OrderView() {
  const number = String(useParams().id ?? "").toUpperCase();
  const search = useSearchParams();
  const { user, ready } = useStore();
  const { m, locale, price } = useI18n();
  const toast = useToast();
  const justConfirmed = search.get("confirmed") === "1";
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [cancelling, setCancelling] = useState(false);

  // Guest access key: from a shared link (?key=) once, otherwise from this browser's storage.
  const keyFromUrl = search.get("key");
  const accessKey = useCallback(() => keyFromUrl ?? guestOrderKey(number), [keyFromUrl, number]);

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const key = accessKey();
    api<{ order: OrderDTO }>(`/orders/${encodeURIComponent(number)}`, { signal: ctrl.signal, headers: key ? { "x-order-key": key } : undefined })
      .then((r) => {
        setOrder(r.order);
        setStatus("ok");
        if (keyFromUrl) {
          // keep the secret out of the address bar / history
          rememberGuestOrder(number, keyFromUrl);
          history.replaceState(null, "", window.location.pathname + (justConfirmed ? "?confirmed=1" : ""));
        }
      })
      .catch((err) => {
        if ((err as Error)?.name === "AbortError") return;
        setStatus(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });
    return () => ctrl.abort();
  }, [ready, user?.id, number, accessKey, keyFromUrl, justConfirmed]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "ar" ? "ar-DZ" : "fr-DZ", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: locale === "ar" ? undefined : false,
    });
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-DZ", { day: "numeric", month: "short" });

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12 md:px-6" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-line/60" />
        <div className="h-48 animate-pulse rounded-card bg-line/40" />
        <div className="h-64 animate-pulse rounded-card bg-line/40" />
      </div>
    );
  }

  if (status !== "ok" || !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center md:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{status === "error" ? m.common.loadFailed : m.order.notFoundTitle}</h1>
        <p className="mt-3 text-sm text-muted">{status === "error" ? "" : user ? m.order.notFoundDesc : m.order.notFoundGuest}</p>
        <div className="mt-7 flex flex-col items-center gap-3">
          {status === "missing" && !user && (
            <Link href={`/login?next=${encodeURIComponent(`/order/${number}`)}`} transitionTypes={["nav-forward"]}>
              <Button size="lg" variant="outline">{m.auth.loginCta}</Button>
            </Link>
          )}
          <Link href="/products" transitionTypes={["nav-back"]}>
            <Button size="lg">{m.order.browseProducts}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const stageMeta: Record<OrderStage, { label: string; cls: string; Icon: typeof Truck }> = {
    processing: { label: m.order.statusProcessing, cls: "bg-accent-soft text-accent-ink", Icon: Loader2 },
    shipped: { label: m.order.statusShipped, cls: "bg-foreground text-background", Icon: Truck },
    delivered: { label: m.order.statusDelivered, cls: "bg-foreground text-background", Icon: PackageCheck },
    cancelled: { label: m.order.statusCancelled, cls: "bg-sale-soft text-danger", Icon: PackageX },
  };
  const meta = stageMeta[order.stage];
  const cancelled = order.stage === "cancelled";

  // Done steps carry their time; the first open step gets an estimate (+1 day per step from the last done one).
  const lastDone = order.timeline.filter((e) => e.at).at(-1)?.at;
  const nextIdx = cancelled ? -1 : order.timeline.findIndex((e) => !e.at);
  const timeline: Row[] = order.timeline.map((e, i): Row => {
    if (e.at) return { ...e, state: "done" };
    if (i === nextIdx) {
      const est = lastDone ? new Date(new Date(lastDone).getTime() + 86400000).toISOString() : null;
      return { step: e.step, at: est, state: "next" };
    }
    return { ...e, state: "pending" };
  });

  const trkL = m.order.trkLabel as Record<string, string>;
  const trkD = m.order.trkDetail as Record<string, string>;
  const wilayaName = WILAYAS.find((w) => w.code === order.address.wilaya)?.[locale === "ar" ? "ar" : "fr"];
  const doneIcons = [Check, PackageCheck, Truck, Truck, CheckCircle2];

  const cancel = async () => {
    if (!window.confirm(m.order.cancelConfirm)) return;
    setCancelling(true);
    try {
      const key = accessKey();
      const r = await api<{ order: OrderDTO }>(`/orders/${encodeURIComponent(number)}/cancel`, {
        method: "POST",
        headers: key ? { "x-order-key": key } : undefined,
      });
      setOrder(r.order);
      toast(m.order.cancelledToast);
    } catch (err) {
      toast(err instanceof ApiError && err.code === "ORDER_NOT_CANCELLABLE" ? m.order.notCancellable : m.common.actionFailed);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <NavTransition>
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
      {justConfirmed && !cancelled && (
        <div className="mb-8 flex items-start gap-3.5 rounded-card bg-volt-soft p-5 text-accent-ink">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-display text-lg font-semibold">{m.order.confirmedTitle}</p>
            <p className="mt-1 text-sm opacity-80">{m.order.confirmationNote}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {justConfirmed && !cancelled ? m.order.confirmedTitle : m.order.detailsTitle}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            <span className="font-medium text-foreground">{order.number}</span> · {m.order.placedOn} {fmt(order.placedAt)}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${meta.cls}`}>
          <meta.Icon size={13} className={order.stage === "processing" ? "animate-spin" : ""} aria-hidden />
          {meta.label}
        </span>
      </div>

      <section className="mt-8 rounded-card border border-line bg-surface p-6 md:p-7" aria-label={m.order.tracking}>
        <h2 className="font-display text-lg font-semibold">{m.order.tracking}</h2>
        {cancelled ? (
          <p className="mt-4 text-sm text-muted">
            {m.order.cancelledOn.replace("{date}", fmt(order.cancelledAt ?? order.placedAt))}
          </p>
        ) : (
          <ol className="relative mt-6">
            <span className="absolute start-[15px] top-4 bottom-8 w-px bg-line" aria-hidden />
            {timeline.map((ev, i) => {
              const Icon = doneIcons[Math.min(i, doneIcons.length - 1)];
              const detail = (trkD[stepDetailKey(ev.step, ev.state === "done", order.carrier)] ?? "").replace("{name}", order.carrier ?? "");
              return (
                <li key={ev.step} className="relative flex gap-4 pb-7 last:pb-0">
                  <span
                    className={cn(
                      "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                      ev.state === "done"
                        ? "border-foreground bg-foreground text-background"
                        : ev.state === "next"
                          ? "border-foreground bg-surface text-foreground"
                          : "border-line bg-surface text-faint",
                    )}
                  >
                    <Icon size={14} aria-hidden />
                  </span>
                  <div className={cn("ms-1 min-w-0 pt-1", ev.state === "pending" && "opacity-55")}>
                    <p className="text-sm font-medium">{trkL[ev.step] ?? ev.step}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {detail}
                      {ev.step === "shipped" && order.trackingNumber && (
                        <span dir="ltr" className="ms-1 font-mono">· {order.trackingNumber}</span>
                      )}
                    </p>
                    <p className="num mt-0.5 text-[11px] text-faint tabular-nums" dir="ltr">
                      {ev.state === "done" && ev.at
                        ? fmt(ev.at)
                        : ev.state === "next" && ev.at
                          ? m.order.est.replace("{date}", fmtDay(ev.at))
                          : m.order.pending}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="rounded-card border border-line bg-surface p-6" aria-label={m.order.items}>
          <h2 className="font-display text-lg font-semibold">{m.order.items}</h2>
          <ul className="mt-4 divide-y divide-line">
            {order.items.map((it, i) => (
              <li key={`${it.slug}-${i}`} className="flex items-center gap-4 py-3.5">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line">
                  <Image src={it.image} alt="" fill sizes="56px" className="object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${it.slug}`} transitionTypes={["nav-forward"]} className="line-clamp-1 text-sm font-medium hover:text-accent-ink" dir="ltr">
                    {it.name}
                  </Link>
                  <p className="text-xs text-faint">
                    {tr(it.variant, locale)} × {it.qty}
                  </p>
                </div>
                <span className="num text-sm font-semibold tabular-nums">{price(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-muted">
              <dt>{m.order.subtotal}</dt>
              <dd className="num text-foreground">{price(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-accent-ink">
                <dt>
                  {m.order.discount}
                  {order.promoCode && <span className="font-mono"> ({order.promoCode})</span>}
                </dt>
                <dd className="num">−{price(order.discount)}</dd>
              </div>
            )}
            {order.shippingFee > 0 && (
              <div className="flex justify-between text-muted">
                <dt>{m.order.shipping}</dt>
                <dd className="num text-foreground">{price(order.shippingFee)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>{m.order.total}</dt>
              <dd className="num">{price(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-card border border-line bg-surface p-5 text-sm">
            <h2 className="flex items-center gap-1.5 font-display font-semibold">
              <MapPin size={14} className="text-accent-ink" aria-hidden /> {m.order.shippingTo}
            </h2>
            <address className="mt-2.5 leading-relaxed text-muted not-italic">
              <span className="font-medium text-foreground">{order.address.fullName}</span>
              <br />
              <span dir="ltr">{order.address.phone}</span>
              <br />
              {order.address.line1}
              <br />
              {order.address.postalCode} {order.address.commune}
              <br />
              {wilayaName ?? order.address.wilaya}
            </address>
          </section>
          <section className="rounded-card border border-line bg-surface p-5 text-sm">
            <h2 className="font-display font-semibold">{m.order.payment}</h2>
            <p className="mt-2 flex items-center gap-1.5 font-medium text-foreground">
              <Clock size={13} className="text-faint" aria-hidden /> {m.order.paymentValue}
            </p>
            {order.paymentStatus === "paid" && <p className="mt-1 text-xs text-accent-ink">{m.order.paid}</p>}
          </section>
          <div className="flex flex-col gap-2.5">
            {order.cancellable && (
              <Button variant="outline" className="w-full gap-1.5" onClick={cancel} disabled={cancelling}>
                {cancelling && <Loader2 size={14} className="animate-spin" />} {m.order.cancelOrder}
              </Button>
            )}
            <Link href="/products" transitionTypes={["nav-back"]}>
              <Button className="w-full gap-1.5">
                {m.order.continueShopping} <ChevronRight size={15} className="rtl:rotate-180" aria-hidden />
              </Button>
            </Link>
            {user && (
              <Link href="/profile?tab=orders" transitionTypes={["nav-forward"]}>
                <Button variant="outline" className="w-full">
                  {m.order.viewAllOrders}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
    </NavTransition>
  );
}
