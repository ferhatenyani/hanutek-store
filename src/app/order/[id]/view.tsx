"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Check, CheckCircle2, Clock, MapPin, Package, PackageCheck, Truck } from "lucide-react";
import { useStore } from "@/lib/store";
import { getProduct } from "@/lib/products";
import { cn, formatDate, formatDateTime, formatPrice } from "@/lib/utils";
import { buttonClasses, Badge } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { NavTransition } from "@/components/nav-transition";

const STATUS_META = {
  processing: { label: "Processing", tone: "accent" as const },
  shipped: { label: "Shipped", tone: "accent" as const },
  delivered: { label: "Delivered", tone: "success" as const },
};

export function OrderView() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const { orders, ready } = useStore();
  const order = orders.find((o) => o.id === id);

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-28 text-center md:px-6">
        <Package size={28} className="text-faint" />
        <h1 className="text-xl font-semibold">Order not found</h1>
        <p className="text-sm text-muted">Orders live in this browser only — this one may have been placed elsewhere.</p>
        <Link href="/products" transitionTypes={["nav-forward"]} className={buttonClasses("dark")}>
          Browse products
        </Link>
      </div>
    );
  }

  const placed = new Date(order.createdAt);
  const future = [
    {
      label: "Out for delivery",
      detail: "With the local courier",
      at: new Date(placed.getTime() + 3 * 86400000).toISOString(),
      icon: Truck,
    },
    {
      label: "Delivered",
      detail: "Estimated arrival",
      at: new Date(placed.getTime() + 4 * 86400000).toISOString(),
      icon: PackageCheck,
    },
  ];
  const doneIcons = [Check, Package, Truck];
  const meta = STATUS_META[order.status];

  return (
    <NavTransition>
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
        <BlurFade duration={0.45}>
          <div className="flex items-start gap-4">
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-success/10 text-success"
            >
              <CheckCircle2 size={24} />
            </motion.span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {isNew ? "Thanks — order confirmed" : "Order details"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                <span className="font-mono text-foreground">{order.id}</span> · placed {formatDateTime(order.createdAt)}
              </p>
              {isNew && (
                <p className="mt-1 text-xs text-faint">
                  A confirmation email would land in your inbox — this demo keeps everything in your browser.
                </p>
              )}
            </div>
            <span className="ml-auto">
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </span>
          </div>
        </BlurFade>

        {/* Tracking */}
        <BlurFade delay={0.15} className="mt-10">
          <h2 className="mb-5 text-base font-semibold">Tracking</h2>
          <ol className="relative space-y-0">
            {order.events.map((ev, i) => {
              const Icon = doneIcons[i] ?? Check;
              const last = i === order.events.length - 1 && order.status !== "delivered";
              return (
                <li key={ev.label} className="relative flex gap-4 pb-8 last:pb-0">
                  {i < order.events.length - 1 && (
                    <span className="absolute top-9 left-[15px] h-[calc(100%-24px)] w-px bg-line" aria-hidden />
                  )}
                  <span
                    className={cn(
                      "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                      last
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-success/30 bg-success/10 text-success",
                    )}
                  >
                    <Icon size={14} />
                    {last && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" aria-hidden />
                    )}
                  </span>
                  <div className="pt-1">
                    <p className="text-sm font-medium">{ev.label}</p>
                    <p className="text-xs text-muted">{ev.detail}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-faint">{ev.at ? formatDateTime(ev.at) : "Pending"}</p>
                  </div>
                </li>
              );
            })}
            {order.status !== "delivered" &&
              future.map((ev, i) => (
                <li key={ev.label} className="relative flex gap-4 pb-8 last:pb-0">
                  {i === 0 && <span className="absolute top-9 left-[15px] h-[calc(100%-24px)] w-px bg-line" aria-hidden />}
                  <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-background text-faint">
                    <ev.icon size={14} />
                  </span>
                  <div className="pt-1">
                    <p className="text-sm font-medium text-muted">{ev.label}</p>
                    <p className="text-xs text-faint">{ev.detail}</p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-faint">
                      <Clock size={10} /> est. {formatDate(ev.at)}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </BlurFade>

        {/* Items */}
        <BlurFade delay={0.2} className="mt-10">
          <h2 className="mb-4 text-base font-semibold">Items</h2>
          <ul className="divide-y divide-line border-y border-line">
            {order.items.map((item) => {
              const p = getProduct(item.productId);
              return (
                <li key={`${item.productId}-${item.variant}`} className="flex items-center gap-4 py-4">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
                    <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    {p ? (
                      <Link href={`/products/${p.slug}`} transitionTypes={["nav-forward"]} className="block truncate text-sm font-medium hover:underline">
                        {item.name}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                    )}
                    <span className="block text-xs text-muted">
                      {item.variant} × {item.qty}
                    </span>
                  </span>
                  <span className="font-mono text-sm">{formatPrice(item.price * item.qty)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-mono">{formatPrice(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd className="font-mono">−{formatPrice(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd className="font-mono">{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium">
              <dt>Total</dt>
              <dd className="font-mono text-base">{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </BlurFade>

        {/* Address */}
        <BlurFade delay={0.25} className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-card border border-line p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted">
              <MapPin size={13} /> Shipping to
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {order.address.fullName}
              <br />
              {order.address.line1}
              <br />
              {order.address.postcode} {order.address.city}
              <br />
              {order.address.country}
            </p>
          </div>
          <div className="rounded-card border border-line p-5">
            <p className="text-xs font-medium text-muted">Payment</p>
            <p className="mt-2 text-sm">{order.payment}</p>
            <p className="mt-3 text-xs text-faint">Mock transaction — nothing was charged.</p>
          </div>
        </BlurFade>

        <BlurFade delay={0.3} className="mt-10 flex flex-wrap gap-3">
          <Link href="/products" transitionTypes={["nav-forward"]} className={buttonClasses("dark")}>
            Continue shopping
          </Link>
          <Link href="/profile" transitionTypes={["nav-forward"]} className={buttonClasses("outline")}>
            View all orders
          </Link>
        </BlurFade>
      </div>
    </NavTransition>
  );
}