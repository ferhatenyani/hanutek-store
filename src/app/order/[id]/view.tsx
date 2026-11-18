"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, ChevronRight, Clock, Loader2, MapPin, PackageCheck, Truck } from "lucide-react";
import { useStore, type OrderStatus, type TrackingEvent } from "@/lib/store";
import { useI18n } from "@/i18n/provider";
import { WILAYAS } from "@/lib/wilayas";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { NavTransition } from "@/components/nav-transition";

export function OrderView() {
  const id = useParams().id as string;
  const { orders, ready } = useStore();
  const { m, locale, price } = useI18n();
  const justConfirmed = useSearchParams().get("confirmed") === "1";
  const order = orders.find((o) => o.id === id);

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

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12 md:px-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-line/60" />
        <div className="h-48 animate-pulse rounded-card bg-line/40" />
        <div className="h-64 animate-pulse rounded-card bg-line/40" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center md:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{m.order.notFoundTitle}</h1>
        <p className="mt-3 text-sm text-muted">{m.order.notFoundDesc}</p>
        <Link href="/products" transitionTypes={["nav-back"]} className="mt-7 inline-block">
          <Button size="lg">{m.order.browseProducts}</Button>
        </Link>
      </div>
    );
  }

  const statusMeta: Record<OrderStatus, { label: string; cls: string; Icon: typeof Truck }> = {
    processing: { label: m.order.statusProcessing, cls: "bg-accent-soft text-accent-ink", Icon: Loader2 },
    shipped: { label: m.order.statusShipped, cls: "bg-foreground text-background", Icon: Truck },
    delivered: { label: m.order.statusDelivered, cls: "bg-foreground text-background", Icon: PackageCheck },
  };
  const meta = statusMeta[order.status];

  const lastDoneAt = order.events.filter((e) => e.at).at(-1)?.at;
  const future: TrackingEvent[] = [];
  if (order.status !== "delivered" && lastDoneAt) {
    const base = new Date(lastDoneAt).getTime();
    const doneLabels = new Set(order.events.map((e) => e.label));
    if (!doneLabels.has("out")) future.push({ label: "out", detail: "withCourier", at: new Date(base + 86400000).toISOString() });
    if (!doneLabels.has("delivered")) future.push({ label: "delivered", detail: "estimatedArrival", at: new Date(base + 2 * 86400000).toISOString() });
  }
  const timeline: (TrackingEvent & { state: "done" | "next" | "pending" })[] = [
    ...order.events.map((e) => ({ ...e, state: (e.at ? "done" : "pending") as "done" | "pending" })),
    ...future.map((e, i) => ({ ...e, state: (i === 0 ? "next" : "pending") as "next" | "pending" })),
  ];

  const trkL = m.order.trkLabel as Record<string, string>;
  const trkD = m.order.trkDetail as Record<string, string>;
  const wilayaName = order.address.wilaya
    ? WILAYAS.find((w) => w.code === order.address.wilaya)?.[locale === "ar" ? "ar" : "fr"]
    : undefined;

  const doneIcons = [Check, PackageCheck, Truck, Truck, CheckCircle2];

  return (
    <NavTransition>
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
      {justConfirmed && (
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
            {justConfirmed ? m.order.confirmedTitle : m.order.detailsTitle}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            <span className="font-medium text-foreground">{order.id}</span> · {m.order.placedOn} {fmt(order.createdAt)}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${meta.cls}`}>
          <meta.Icon size={13} className={order.status === "processing" ? "animate-spin" : ""} aria-hidden />
          {meta.label}
        </span>
      </div>

      <section className="mt-8 rounded-card border border-line bg-surface p-6 md:p-7" aria-label={m.order.tracking}>
        <h2 className="font-display text-lg font-semibold">{m.order.tracking}</h2>
        <ol className="relative mt-6">
          <span className="absolute start-[15px] top-4 bottom-8 w-px bg-line" aria-hidden />
          {timeline.map((ev, i) => {
            const Icon = doneIcons[Math.min(i, doneIcons.length - 1)];
            return (
              <li key={`${ev.label}-${i}`} className="relative flex gap-4 pb-7 last:pb-0">
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
                  <p className="text-sm font-medium">{trkL[ev.label] ?? ev.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{trkD[ev.detail] ?? ev.detail}</p>
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
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="rounded-card border border-line bg-surface p-6" aria-label={m.order.items}>
          <h2 className="font-display text-lg font-semibold">{m.order.items}</h2>
          <ul className="mt-4 divide-y divide-line">
            {order.items.map((it) => (
              <li key={`${it.productId}-${it.variant}`} className="flex items-center gap-4 py-3.5">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line">
                  <Image src={it.image} alt="" fill sizes="56px" className="object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${it.productId}`} transitionTypes={["nav-forward"]} className="line-clamp-1 text-sm font-medium hover:text-accent-ink" dir="ltr">
                    {it.name}
                  </Link>
                  <p className="text-xs text-faint">
                    {it.variant} × {it.qty}
                  </p>
                </div>
                <span className="num text-sm font-semibold tabular-nums">{price(it.price * it.qty)}</span>
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
                <dt>{m.order.discount}</dt>
                <dd className="num">−{price(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <dt>{m.order.shipping}</dt>
              <dd className="num text-foreground">{price(order.shipping)}</dd>
            </div>
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
              {order.address.line1}
              <br />
              {order.address.postcode} {order.address.city}
              <br />
              {wilayaName ?? order.address.country}
            </address>
          </section>
          <section className="rounded-card border border-line bg-surface p-5 text-sm">
            <h2 className="font-display font-semibold">{m.order.payment}</h2>
            <p className="mt-2 flex items-center gap-1.5 font-medium text-foreground">
              <Clock size={13} className="text-faint" aria-hidden /> {m.order.paymentValue}
            </p>
          </section>
          <div className="flex flex-col gap-2.5">
            <Link href="/products" transitionTypes={["nav-back"]}>
              <Button className="w-full gap-1.5">
                {m.order.continueShopping} <ChevronRight size={15} className="rtl:rotate-180" aria-hidden />
              </Button>
            </Link>
            <Link href="/profile?tab=orders" transitionTypes={["nav-forward"]}>
              <Button variant="outline" className="w-full">
                {m.order.viewAllOrders}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
    </NavTransition>
  );
}
