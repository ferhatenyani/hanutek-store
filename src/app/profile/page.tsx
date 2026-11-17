"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
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
import { getProduct } from "@/lib/products";
import { useStore, type Address, type Order, type OrderStatus } from "@/lib/store";
import { useI18n } from "@/i18n/provider";
import { WILAYAS } from "@/lib/wilayas";
import { Button, buttonClasses, Input, Select } from "@/components/ui/primitives";
import { ProductCard } from "@/components/product-card";
import { NavTransition } from "@/components/nav-transition";
import { BlurFade } from "@/components/ui/blur-fade";
import { TextAnimate } from "@/components/ui/text-animate";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Tab = "orders" | "favorites" | "settings";
const TABS: { id: Tab; Icon: typeof ShoppingBag }[] = [
  { id: "orders", Icon: ShoppingBag },
  { id: "favorites", Icon: Heart },
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
  const { user, orders, favorites, logout, updateProfile, ready } = useStore();
  const { m, locale, price } = useI18n();
  const router = useRouter();
  const toast = useToast();
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
  const TAB_LABEL: Record<Tab, string> = { orders: m.profile.orders, favorites: m.profile.favorites, settings: m.profile.settings };

  const trkL = m.order.trkLabel as Record<string, string>;
  const trkD = m.order.trkDetail as Record<string, string>;
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-DZ", { day: "numeric", month: "short", year: "numeric" });

  const favoriteProducts = favorites.map(getProduct).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <NavTransition>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
        <BlurFade duration={0.5}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-foreground font-display text-xl font-semibold text-background">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <TextAnimate as="h1" by="word" className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  {`${m.profile.welcome}, ${user.name.split(" ")[0]}`}
                </TextAnimate>
                <p className="mt-0.5 text-sm text-muted" dir="ltr">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                logout();
                toast(m.profile.signedOut);
                router.push("/");
              }}
            >
              <LogOut size={14} className="rtl:rotate-180" aria-hidden /> {m.profile.logout}
            </Button>
          </div>
        </BlurFade>

        <BlurFade delay={0.1}>
          <div role="tablist" aria-label={m.profile.accountSections} className="mt-8 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ id, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  tab === id ? "text-foreground" : "text-faint hover:text-muted",
                )}
              >
                <Icon size={15} aria-hidden />
                {TAB_LABEL[id]}
                {id === "favorites" && favorites.length > 0 && (
                  <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-ink tabular-nums">{favorites.length}</span>
                )}
                {tab === id && (
                  <motion.span layoutId="profile-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
              </button>
            ))}
          </div>
        </BlurFade>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7"
          >
            {tab === "orders" && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <EmptyState Icon={PackageOpen} title={m.profile.noOrders} desc={m.profile.noOrdersDesc}>
                    <Link href="/products" transitionTypes={["nav-forward"]} className={buttonClasses("primary", "md")}>
                      {m.profile.startShopping}
                    </Link>
                  </EmptyState>
                ) : (
                  orders.map((order, i) => (
                    <BlurFade key={order.id} delay={0.05 * i}>
                      <OrderCard order={order} STATUS_META={STATUS_META} trkL={trkL} trkD={trkD} fmtDay={fmtDay} price={price} m={m} />
                    </BlurFade>
                  ))
                )}
              </div>
            )}

            {tab === "favorites" &&
              (favoriteProducts.length === 0 ? (
                <EmptyState Icon={Heart} title={m.favorites.emptyTitle} desc={m.favorites.emptyDesc}>
                  <Link href="/products" transitionTypes={["nav-forward"]} className={buttonClasses("primary", "md")}>
                    {m.favorites.browseCta}
                  </Link>
                </EmptyState>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
                  {favoriteProducts.map((p, i) => (
                    <BlurFade key={p.slug} delay={0.05 * i}>
                      <ProductCard product={p} />
                    </BlurFade>
                  ))}
                </div>
              ))}

            {tab === "settings" && (
              <SettingsForm
                name={user.name}
                email={user.email}
                phone={user.phone ?? ""}
                address={user.address}
                m={m}
                onSave={(patch) => {
                  updateProfile(patch);
                  toast(m.profile.profileUpdated);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
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
    <article className="overflow-hidden rounded-card border border-line bg-background">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-5">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">{order.id}</p>
          <p className="mt-0.5 text-xs text-faint">
            {m.order.placedOn} {fmtDay(order.createdAt)} · {itemCount} {itemCount === 1 ? m.order.itemOne : m.order.items.toLowerCase()}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium">
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot, order.status === "processing" && "animate-pulse")} aria-hidden />
          {meta.label}
        </span>
        <span className="ms-auto font-display text-base font-semibold tabular-nums">{price(order.total)}</span>
        <Link
          href={`/order/${order.id}`}
          transitionTypes={["nav-forward"]}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
        >
          {m.profile.fullTracking} <ChevronRight size={14} className="rtl:rotate-180" aria-hidden />
        </Link>
      </div>

      <div className="border-t border-line bg-surface/50 px-5 py-4">
        <div className="flex items-center gap-1.5" aria-hidden>
          {order.events.map((ev, i) => (
            <span key={i} className="flex flex-1 items-center gap-1.5 last:flex-none">
              <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full", ev.at ? "bg-foreground text-background" : "border border-line bg-background text-faint")}>
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
          className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          {m.profile.tracking}
          <ChevronDown size={13} className={cn("transition-transform duration-300", open && "rotate-180")} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
              <ol className="mt-3 space-y-2.5 border-t border-line pt-3">
                {order.events.map((ev, i) => (
                  <li key={i} className={cn("flex items-baseline justify-between gap-3 text-xs", !ev.at && "opacity-50")}>
                    <span>
                      <span className="font-medium">{trkL[ev.label] ?? ev.label}</span>
                      <span className="text-faint"> — {trkD[ev.detail] ?? ev.detail}</span>
                    </span>
                    <span className="shrink-0 text-faint tabular-nums" dir="ltr">{ev.at ? fmtDay(ev.at) : m.profile.pending}</span>
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
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
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAddr((a) => ({ ...a, [k]: e.target.value }));

  return (
    <form
      className="grid max-w-2xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: displayName.trim() || name, phone: phoneVal, address: addr });
      }}
    >
      <section className="rounded-card border border-line bg-background p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <User size={16} className="text-accent-ink" aria-hidden /> {m.profile.accountSection}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label={m.profile.displayName} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Input label={m.auth.email} value={email} readOnly className="opacity-60" dir="ltr" />
          <Input label={`${m.profile.phone} · ${m.profile.optional}`} value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} placeholder="0550 00 00 00" dir="ltr" />
        </div>
      </section>

      <section className="rounded-card border border-line bg-background p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <MapPin size={16} className="text-accent-ink" aria-hidden /> {m.profile.defaultAddress}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label={m.profile.fullName} value={addr.fullName} onChange={set("fullName")} className="sm:col-span-2" />
          <Input label={m.profile.address} value={addr.line1} onChange={set("line1")} placeholder={m.profile.addressPlaceholder} className="sm:col-span-2" />
          <Input label={m.profile.city} value={addr.city} onChange={set("city")} />
          <Input label={m.profile.postcode} value={addr.postcode} onChange={set("postcode")} dir="ltr" />
          <Select label={m.profile.wilaya} name="wilaya" value={addr.wilaya ?? "16"} onChange={set("wilaya")} className="sm:col-span-2">
            {WILAYAS.map((w) => (
              <option key={w.code} value={w.code}>
                {w.code} — {locale === "ar" ? w.ar : w.fr}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <div>
        <Button type="submit" size="lg">{m.profile.saveChanges}</Button>
        <p className="mt-2 text-[11px] text-faint">{m.profile.storedLocally}</p>
      </div>
    </form>
  );
}

function EmptyState({ Icon, title, desc, children }: { Icon: typeof Heart; title: string; desc: string; children: React.ReactNode }) {
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
