"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  LogOut,
  MapPin,
  PackageCheck,
  PackageOpen,
  Settings,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import { useStore, type Address, type Order, type OrderStatus } from "@/lib/store";
import { useI18n } from "@/i18n/provider";
import { WILAYAS } from "@/lib/wilayas";
import { Button, buttonClasses, Input } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/select-menu";
import { cn } from "@/lib/utils";
import { LocaleToggle } from "@/components/layout/header";
import { NavTransition } from "@/components/nav-transition";

type Tab = "orders" | "settings";
const TABS: { id: Tab; Icon: typeof ShoppingBag }[] = [
  { id: "orders", Icon: ShoppingBag },
  { id: "settings", Icon: Settings },
];

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const { user, orders, logout, updateProfile, ready } = useStore();
  const { m, locale, price } = useI18n();
  const router = useRouter();
  const tabParam = useSearchParams().get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "orders");

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/profile");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12 md:px-6">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-line/60" />
        <div className="h-64 animate-pulse rounded-card bg-line/40" />
      </div>
    );
  }

  const STATUS_META: Record<OrderStatus, { label: string; dot: string; Icon: typeof Truck }> = {
    processing: { label: m.profile.statusProcessing, dot: "bg-muted", Icon: Loader2 },
    shipped: { label: m.order.statusShipped, dot: "bg-foreground", Icon: Truck },
    delivered: { label: m.order.statusDelivered, dot: "bg-foreground", Icon: PackageCheck },
  };
  const TAB_LABEL: Record<Tab, string> = { orders: m.profile.orders, settings: m.profile.settings };

  const trkL = m.order.trkLabel as Record<string, string>;
  const trkD = m.order.trkDetail as Record<string, string>;
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-DZ", { day: "numeric", month: "short", year: "numeric" });

  return (
    <NavTransition>
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-foreground font-display text-xl font-semibold text-background">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {m.profile.welcome}, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-0.5 text-sm text-muted" dir="ltr">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LocaleToggle className="lg:hidden" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              logout();
              router.push("/", { transitionTypes: ["nav-back"] });
            }}
          >
            <LogOut size={14} className="rtl:rotate-180" aria-hidden /> {m.profile.logout}
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label={m.profile.accountSections} className="mt-8 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ id, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-150",
              tab === id ? "text-foreground" : "text-faint hover:text-muted",
            )}
          >
            <Icon size={15} aria-hidden />
            {TAB_LABEL[id]}
            {tab === id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />}
          </button>
        ))}
      </div>

      <div className="mt-7">
        {tab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <EmptyState Icon={PackageOpen} title={m.profile.noOrders} desc={m.profile.noOrdersDesc}>
                <Link href="/products" transitionTypes={["nav-back"]} className={buttonClasses("primary", "md")}>
                  {m.profile.startShopping}
                </Link>
              </EmptyState>
            ) : (
              orders.map((order) => (
                <OrderCard key={order.id} order={order} STATUS_META={STATUS_META} trkL={trkL} trkD={trkD} fmtDay={fmtDay} price={price} m={m} />
              ))
            )}
          </div>
        )}

        {tab === "settings" && (
          <SettingsForm
            name={user.name}
            email={user.email}
            phone={user.phone ?? ""}
            address={user.address}
            m={m}
            onSave={(patch) => {
              updateProfile(patch);
            }}
          />
        )}
      </div>
    </div>
    </NavTransition>
  );
}

function OrderCard({
  order,
  STATUS_META,
  trkL,
  trkD,
  fmtDay,
  price,
  m,
}: {
  order: Order;
  STATUS_META: Record<OrderStatus, { label: string; dot: string; Icon: typeof Truck }>;
  trkL: Record<string, string>;
  trkD: Record<string, string>;
  fmtDay: (iso: string) => string;
  price: (n: number) => string;
  m: ReturnType<typeof useI18n>["m"];
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[order.status];
  const doneCount = order.events.filter((e) => e.at).length;
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
  const eta = new Date(new Date(order.createdAt).getTime() + 4 * 86400000).toISOString();

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-5">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">{order.id}</p>
          <p className="mt-0.5 text-xs text-faint">
            {m.order.placedOn} {fmtDay(order.createdAt)} · {itemCount} {itemCount === 1 ? m.order.itemOne : m.order.items.toLowerCase()}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
          {meta.label}
        </span>
        <span className="num ms-auto font-display text-base font-semibold tabular-nums">{price(order.total)}</span>
        <Link
          href={`/order/${order.id}`}
          transitionTypes={["nav-forward"]}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
        >
          {m.profile.fullTracking} <ChevronRight size={14} className="rtl:rotate-180" aria-hidden />
        </Link>
      </div>

      <div className="border-t border-line bg-accent-soft/40 px-5 py-4">
        <div className="flex items-center gap-1.5" aria-hidden>
          {order.events.map((ev, i) => (
            <span key={i} className="flex flex-1 items-center gap-1.5 last:flex-none">
              <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full", ev.at ? "bg-foreground text-background" : "border border-line bg-surface text-faint")}>
                {ev.at ? <Check size={10} /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              {i < order.events.length - 1 && <span className={cn("h-px flex-1", ev.at ? "bg-foreground" : "bg-line")} />}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
          <span>{trkL[order.events[Math.max(0, doneCount - 1)].label] ?? ""}</span>
          {order.status !== "delivered" && <span>{m.profile.deliveryEstimated.replace("{date}", fmtDay(eta))}</span>}
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          {m.profile.tracking}
          <ChevronDown size={13} className={cn("transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <ol className="mt-3 space-y-2.5 border-t border-line pt-3">
            {order.events.map((ev, i) => (
              <li key={i} className={cn("flex items-baseline justify-between gap-3 text-xs", !ev.at && "opacity-50")}>
                <span>
                  <span className="font-medium">{trkL[ev.label] ?? ev.label}</span>
                  <span className="text-faint"> — {trkD[ev.detail] ?? ev.detail}</span>
                </span>
                <span className="num shrink-0 text-faint tabular-nums" dir="ltr">{ev.at ? fmtDay(ev.at) : m.profile.pending}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

function SettingsForm({
  name,
  email,
  phone,
  address,
  m,
  onSave,
}: {
  name: string;
  email: string;
  phone: string;
  address?: Address;
  m: ReturnType<typeof useI18n>["m"];
  onSave: (patch: { name?: string; phone?: string; address?: Address }) => void;
}) {
  const { locale } = useI18n();
  const [displayName, setDisplayName] = useState(name);
  const [phoneVal, setPhoneVal] = useState(phone);
  const [addr, setAddr] = useState<Address>(
    address ?? { fullName: name, line1: "", city: "", postcode: "", country: "Algérie", wilaya: "16" },
  );

  return (
    <form
      className="grid max-w-2xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: displayName.trim() || name, phone: phoneVal, address: addr });
      }}
    >
      <section className="rounded-card border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <User size={16} className="text-accent-ink" aria-hidden /> {m.profile.accountSection}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label={m.profile.displayName} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Input label={m.auth.email} value={email} readOnly className="opacity-60" dir="ltr" />
          <Input label={`${m.profile.phone} · ${m.profile.optional}`} value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} placeholder="0550 00 00 00" dir="ltr" />
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <MapPin size={16} className="text-accent-ink" aria-hidden /> {m.profile.defaultAddress}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label={m.profile.fullName} value={addr.fullName} onChange={(e) => setAddr((a) => ({ ...a, fullName: e.target.value }))} className="sm:col-span-2" />
          <Input label={m.profile.address} value={addr.line1} onChange={(e) => setAddr((a) => ({ ...a, line1: e.target.value }))} placeholder={m.profile.addressPlaceholder} className="sm:col-span-2" />
          <Input label={m.profile.city} value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} />
          <Input label={m.profile.postcode} value={addr.postcode} onChange={(e) => setAddr((a) => ({ ...a, postcode: e.target.value }))} dir="ltr" />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium text-foreground">{m.profile.wilaya}</p>
            <SelectMenu
              ariaLabel={m.profile.wilaya}
              value={addr.wilaya ?? "16"}
              onChange={(v) => setAddr((a) => ({ ...a, wilaya: v }))}
              options={WILAYAS.map((w) => ({ value: w.code, label: `${w.code} — ${locale === "ar" ? w.ar : w.fr}` }))}
              buttonClassName="h-11 rounded-control px-3.5"
              align="start"
            />
          </div>
        </div>
      </section>

      <div>
        <Button type="submit" size="lg">{m.profile.saveChanges}</Button>
        <p className="mt-2 text-[11px] text-faint">{m.profile.storedLocally}</p>
      </div>
    </form>
  );
}

function EmptyState({ Icon, title, desc, children }: { Icon: typeof ShoppingBag; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <Icon size={22} aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">{desc}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
