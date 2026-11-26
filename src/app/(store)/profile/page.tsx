"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Loader2,
  LogOut,
  MailWarning,
  MapPin,
  PackageCheck,
  PackageOpen,
  PackageX,
  Settings,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import type { AddressDTO, OrderStage, OrderSummaryDTO, UserDTO } from "@/lib/api-types";
import { isClosed, stepDetailKey } from "@/lib/order-ui";
import { useI18n } from "@/i18n/provider";
import { WILAYAS } from "@/lib/wilayas";
import { Button, buttonClasses, Input } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/select-menu";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { LocaleToggle } from "@/components/layout/header";
import { NavTransition } from "@/components/nav-transition";

type Tab = "orders" | "settings";
const TABS: { id: Tab; Icon: typeof ShoppingBag }[] = [
  { id: "orders", Icon: ShoppingBag },
  { id: "settings", Icon: Settings },
];

type Msgs = ReturnType<typeof useI18n>["m"];
type StageMeta = Record<OrderStage, { label: string; dot: string; Icon: typeof Truck }>;

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const { user, logout, ready } = useStore();
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

  const STAGE_META: StageMeta = {
    processing: { label: m.profile.statusProcessing, dot: "bg-muted", Icon: Loader2 },
    shipped: { label: m.order.statusShipped, dot: "bg-foreground", Icon: Truck },
    delivered: { label: m.order.statusDelivered, dot: "bg-foreground", Icon: PackageCheck },
    cancelled: { label: m.order.statusCancelled, dot: "bg-danger", Icon: PackageX },
  };
  const TAB_LABEL: Record<Tab, string> = { orders: m.profile.orders, settings: m.profile.settings };
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-DZ", { day: "numeric", month: "short", year: "numeric" });

  return (
    <NavTransition>
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-foreground font-display text-xl font-semibold text-background">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-3xl">
              {m.profile.welcome}, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-0.5 truncate text-sm text-muted rtl:text-right" dir="ltr" title={user.email}>{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LocaleToggle className="lg:hidden" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              await logout();
              toast(m.profile.signedOut);
              router.push("/", { transitionTypes: ["nav-back"] });
            }}
          >
            <LogOut size={14} className="rtl:rotate-180" aria-hidden /> {m.profile.logout}
          </Button>
        </div>
      </div>

      {!user.emailVerified && <VerifyBanner m={m} />}

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
        {tab === "orders" && <OrdersTab STAGE_META={STAGE_META} fmtDay={fmtDay} price={price} m={m} />}
        {tab === "settings" && (
          <div className="grid max-w-2xl gap-6">
            <SettingsForm user={user} m={m} />
            <PasswordForm hasPassword={user.hasPassword} m={m} />
          </div>
        )}
      </div>
    </div>
    </NavTransition>
  );
}

function VerifyBanner({ m }: { m: Msgs }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card border border-line bg-accent-soft/60 px-4 py-3 text-sm">
      <MailWarning size={16} className="shrink-0 text-accent-ink" aria-hidden />
      <span className="min-w-0 flex-1 text-muted">{m.profile.verifyPending}</span>
      <button
        type="button"
        disabled={sent}
        onClick={async () => {
          try {
            await api("/auth/verify-email/resend", { method: "POST" });
            setSent(true);
            toast(m.profile.verifySent);
          } catch (err) {
            toast(err instanceof ApiError && err.code === "RATE_LIMITED" ? m.common.tooMany : m.common.actionFailed);
          }
        }}
        className="cursor-pointer text-[13px] font-medium text-accent-ink underline underline-offset-2 disabled:cursor-default disabled:no-underline disabled:opacity-60"
      >
        {sent ? m.profile.verifySent : m.profile.verifyResend}
      </button>
    </div>
  );
}

function OrdersTab({ STAGE_META, fmtDay, price, m }: { STAGE_META: StageMeta; fmtDay: (iso: string) => string; price: (n: number) => string; m: Msgs }) {
  const [orders, setOrders] = useState<OrderSummaryDTO[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api<{ items: OrderSummaryDTO[] }>("/me/orders", { signal: ctrl.signal })
      .then((r) => setOrders(r.items))
      .catch((err) => (err as Error)?.name !== "AbortError" && setError(true));
    return () => ctrl.abort();
  }, [attempt]);

  if (error) {
    return (
      <EmptyState Icon={PackageOpen} title={m.common.loadFailed} desc="">
        <Button
          variant="outline"
          onClick={() => {
            setError(false);
            setAttempt((n) => n + 1);
          }}
        >
          {m.common.retry}
        </Button>
      </EmptyState>
    );
  }
  if (!orders) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-card bg-line/40" />
        ))}
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <EmptyState Icon={PackageOpen} title={m.profile.noOrders} desc={m.profile.noOrdersDesc}>
        <Link href="/products" transitionTypes={["nav-back"]} className={buttonClasses("primary", "md")}>
          {m.profile.startShopping}
        </Link>
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderCard key={order.number} order={order} STAGE_META={STAGE_META} fmtDay={fmtDay} price={price} m={m} />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  STAGE_META,
  fmtDay,
  price,
  m,
}: {
  order: OrderSummaryDTO;
  STAGE_META: StageMeta;
  fmtDay: (iso: string) => string;
  price: (n: number) => string;
  m: Msgs;
}) {
  const [open, setOpen] = useState(false);
  const meta = STAGE_META[order.stage];
  const trkL = m.order.trkLabel as Record<string, string>;
  const trkD = m.order.trkDetail as Record<string, string>;
  const events = order.timeline;
  const doneCount = events.filter((e) => e.at).length;
  const eta = new Date(new Date(order.placedAt).getTime() + 4 * 86400000).toISOString();
  const cancelled = order.stage === "cancelled";

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-5">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">{order.number}</p>
          <p className="mt-0.5 text-xs text-faint">
            {m.order.placedOn} {fmtDay(order.placedAt)} · {order.itemCount} {order.itemCount === 1 ? m.order.itemOne : m.order.items.toLowerCase()}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
          {meta.label}
        </span>
        <span className="num ms-auto font-display text-base font-semibold tabular-nums">{price(order.total)}</span>
        <Link
          href={`/order/${order.number}`}
          transitionTypes={["nav-forward"]}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
        >
          {m.profile.fullTracking} <ChevronRight size={14} className="rtl:rotate-180" aria-hidden />
        </Link>
      </div>

      {!cancelled && (
        <div className="border-t border-line bg-accent-soft/40 px-5 py-4">
          <div className="flex items-center gap-1.5" aria-hidden>
            {events.map((ev, i) => (
              <span key={ev.step} className="flex flex-1 items-center gap-1.5 last:flex-none">
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full", ev.at ? "bg-foreground text-background" : "border border-line bg-surface text-faint")}>
                  {ev.at ? <Check size={10} /> : <span className="h-1 w-1 rounded-full bg-current" />}
                </span>
                {i < events.length - 1 && <span className={cn("h-px flex-1", ev.at ? "bg-foreground" : "bg-line")} />}
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
            <span>{trkL[events[Math.max(0, doneCount - 1)].step] ?? ""}</span>
            {!isClosed(order.stage) && <span>{m.profile.deliveryEstimated.replace("{date}", fmtDay(eta))}</span>}
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
              {events.map((ev) => (
                <li key={ev.step} className={cn("flex items-baseline justify-between gap-3 text-xs", !ev.at && "opacity-50")}>
                  <span>
                    <span className="font-medium">{trkL[ev.step] ?? ev.step}</span>
                    <span className="text-faint"> — {(trkD[stepDetailKey(ev.step, Boolean(ev.at))] ?? "").replace("{name}", "")}</span>
                  </span>
                  <span className="num shrink-0 text-faint tabular-nums" dir="ltr">{ev.at ? fmtDay(ev.at) : m.profile.pending}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  );
}

const PHONE_RE = /^(?:\+213|00213|0)[1-9]\d{7,8}$/;

function SettingsForm({ user, m }: { user: UserDTO; m: Msgs }) {
  const { locale } = useI18n();
  const { updateProfile } = useStore();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user.name);
  const [phoneVal, setPhoneVal] = useState(user.phone ?? "");
  const [addr, setAddr] = useState<Omit<AddressDTO, "id">>(
    user.defaultAddress ?? { fullName: user.name, phone: null, line1: "", commune: "", wilaya: "16", postalCode: "" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (displayName.trim().length < 2) errs.name = m.checkout.required;
    const phone = phoneVal.replace(/[\s.\-()]/g, "");
    if (phone && !PHONE_RE.test(phone)) errs.phone = m.checkout.invalidPhone;
    const hasAddress = Boolean(addr.line1.trim() || addr.commune.trim());
    if (hasAddress) {
      if (!addr.fullName.trim()) errs.fullName = m.checkout.required;
      if (!addr.line1.trim()) errs.line1 = m.checkout.required;
      if (!addr.commune.trim()) errs.commune = m.checkout.required;
      if (addr.postalCode && !/^\d{5}$/.test(addr.postalCode)) errs.postalCode = m.checkout.invalidPostcode;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await updateProfile({
        name: displayName.trim(),
        phone: phone || null,
        defaultAddress: hasAddress ? { ...addr, phone: phone || addr.phone || null, postalCode: addr.postalCode || null } : null,
      });
      toast(m.profile.profileUpdated);
    } catch (err) {
      toast(err instanceof ApiError && err.code === "VALIDATION" ? m.checkout.checkFields : m.common.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-6" onSubmit={save} noValidate>
      <section className="rounded-card border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <User size={16} className="text-accent-ink" aria-hidden /> {m.profile.accountSection}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label={m.profile.displayName} error={errors.name} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
          <Input label={m.auth.email} value={user.email} readOnly className="opacity-60" dir="ltr" />
          <Input label={`${m.profile.phone} · ${m.profile.optional}`} error={errors.phone} value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} placeholder="0550 00 00 00" dir="ltr" inputMode="tel" maxLength={20} />
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <MapPin size={16} className="text-accent-ink" aria-hidden /> {m.profile.defaultAddress}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label={m.profile.fullName} error={errors.fullName} value={addr.fullName} onChange={(e) => setAddr((a) => ({ ...a, fullName: e.target.value }))} containerClassName="sm:col-span-2" maxLength={120} />
          <Input label={m.profile.address} error={errors.line1} value={addr.line1} onChange={(e) => setAddr((a) => ({ ...a, line1: e.target.value }))} placeholder={m.profile.addressPlaceholder} containerClassName="sm:col-span-2" maxLength={200} />
          <Input label={m.profile.city} error={errors.commune} value={addr.commune} onChange={(e) => setAddr((a) => ({ ...a, commune: e.target.value }))} maxLength={80} />
          <Input label={m.profile.postcode} error={errors.postalCode} value={addr.postalCode ?? ""} onChange={(e) => setAddr((a) => ({ ...a, postalCode: e.target.value }))} dir="ltr" inputMode="numeric" maxLength={5} />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium text-foreground">{m.profile.wilaya}</p>
            <SelectMenu
              ariaLabel={m.profile.wilaya}
              value={addr.wilaya || "16"}
              onChange={(v) => setAddr((a) => ({ ...a, wilaya: v }))}
              options={WILAYAS.map((w) => ({ value: w.code, label: `${w.code} — ${locale === "ar" ? w.ar : w.fr}` }))}
              buttonClassName="h-11 rounded-control px-3.5"
              align="start"
            />
          </div>
        </div>
      </section>

      <div>
        <Button type="submit" size="lg" disabled={busy} className="gap-2">
          {busy && <Loader2 size={16} className="animate-spin" />} {m.profile.saveChanges}
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ hasPassword, m }: { hasPassword: boolean; m: Msgs }) {
  const toast = useToast();
  const { reloadSession } = useStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError(m.auth.errPasswordRegister);
    setBusy(true);
    setError("");
    try {
      await api("/auth/password/change", { method: "POST", body: { currentPassword: hasPassword ? current : undefined, newPassword: next } });
      setCurrent("");
      setNext("");
      toast(m.auth.passwordUpdated);
      await reloadSession().catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "INVALID_CREDENTIALS" ? m.profile.currentPasswordWrong : m.common.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-card border border-line bg-surface p-6" noValidate>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <KeyRound size={16} className="text-accent-ink" aria-hidden /> {hasPassword ? m.profile.changePassword : m.profile.setPassword}
      </h2>
      <p className="mt-1 text-xs text-muted">{m.profile.passwordHint}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {hasPassword && (
          <Input label={m.profile.currentPassword} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" dir="ltr" maxLength={128} />
        )}
        <Input label={m.auth.newPassword} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" dir="ltr" placeholder={m.auth.passwordPlaceholderRegister} maxLength={128} />
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
      <Button type="submit" variant="outline" className="mt-4 gap-2" disabled={busy || !next}>
        {busy && <Loader2 size={15} className="animate-spin" />} {m.auth.savePassword}
      </Button>
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
      {desc && <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">{desc}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
