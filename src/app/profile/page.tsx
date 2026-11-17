"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  Clock,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  Settings,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useStore, type Order } from "@/lib/store";
import { cn, formatDate, formatDateTime, formatPrice } from "@/lib/utils";
import { Button, Input, Select, buttonClasses, Badge } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { NavTransition } from "@/components/nav-transition";
import { useToast } from "@/components/ui/toast";

const STATUS_META = {
  processing: { label: "Processing", tone: "accent" as const },
  shipped: { label: "Shipped", tone: "accent" as const },
  delivered: { label: "Delivered", tone: "success" as const },
};

function OrderCard({ order, index }: { order: Order; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const meta = STATUS_META[order.status];
  return (
    <BlurFade inView delay={index * 0.06}>
      <div className="overflow-hidden rounded-card border border-line bg-background">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left transition-colors hover:bg-surface/60 md:p-5"
        >
          <span className="flex -space-x-3">
            {order.items.slice(0, 3).map((item) => (
              <span
                key={`${item.productId}-${item.variant}`}
                className="relative h-10 w-10 overflow-hidden rounded-lg border-2 border-background bg-surface"
              >
                <Image src={item.image} alt="" fill sizes="40px" className="object-cover" />
              </span>
            ))}
            {order.items.length > 3 && (
              <span className="grid h-10 w-10 place-items-center rounded-lg border-2 border-background bg-surface font-mono text-[10px] text-muted">
                +{order.items.length - 3}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-sm font-medium">{order.id}</span>
            <span className="block text-xs text-muted">{formatDate(order.createdAt)}</span>
          </span>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="font-mono text-sm font-medium">{formatPrice(order.total)}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={16} className="text-muted" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-line p-4 md:p-5">
                <ul className="space-y-2.5">
                  {order.items.map((item) => (
                    <li key={`${item.productId}-${item.variant}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {item.name} <span className="text-muted">· {item.variant} × {item.qty}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[13px]">{formatPrice(item.price * item.qty)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-xl bg-surface/70 p-4">
                  <p className="mb-3 text-xs font-medium text-muted">Tracking</p>
                  <ol className="space-y-2.5">
                    {order.events.map((ev) => (
                      <li key={ev.label} className="flex items-center gap-2.5 text-[13px]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                        <span className="font-medium">{ev.label}</span>
                        <span className="truncate text-xs text-muted">{ev.detail}</span>
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-faint">
                          {ev.at ? formatDateTime(ev.at) : "Pending"}
                        </span>
                      </li>
                    ))}
                    {order.status !== "delivered" && (
                      <li className="flex items-center gap-2.5 text-[13px] text-faint">
                        <Clock size={11} className="shrink-0" />
                        <span>Delivery estimated {formatDate(new Date(new Date(order.createdAt).getTime() + 4 * 86400000).toISOString())}</span>
                      </li>
                    )}
                  </ol>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <MapPin size={12} />
                    {order.address.fullName}, {order.address.city}, {order.address.country}
                  </p>
                  <Link
                    href={`/order/${order.id}`}
                    transitionTypes={["nav-forward"]}
                    className="text-xs font-medium text-accent-ink hover:underline"
                  >
                    Full tracking →
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BlurFade>
  );
}

export default function ProfilePage() {
  const { user, orders, ready, logout, updateProfile } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"orders" | "settings">("orders");

  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    fullName: user?.address?.fullName ?? user?.name ?? "",
    line1: user?.address?.line1 ?? "",
    city: user?.address?.city ?? "",
    postcode: user?.address?.postcode ?? "",
    country: user?.address?.country ?? "Ireland",
  });

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/profile");
  }, [ready, user, router]);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name,
        email: user.email,
        phone: user.phone ?? "",
        fullName: user.address?.fullName ?? user.name,
        line1: user.address?.line1 ?? "",
        city: user.address?.city ?? "",
        postcode: user.address?.postcode ?? "",
        country: user.address?.country ?? "Ireland",
      });
    }
  }, [user]);

  if (!ready || !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 md:px-6">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: profile.name.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
      address: {
        fullName: profile.fullName.trim(),
        line1: profile.line1,
        city: profile.city,
        postcode: profile.postcode,
        country: profile.country,
      },
    });
    toast("Profile updated");
  };

  const set = (key: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setProfile((p) => ({ ...p, [key]: e.target.value }));

  return (
    <NavTransition>
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
        <BlurFade duration={0.4}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-volt font-mono text-lg font-semibold text-accent">
              {initials || "H"}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{user.name}</h1>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted"
              onClick={() => {
                logout();
                toast("Signed out");
                router.replace("/");
              }}
            >
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        </BlurFade>

        <BlurFade delay={0.1} duration={0.4}>
          <div className="mt-8 inline-flex rounded-full border border-line bg-surface p-1" role="tablist" aria-label="Account sections">
            {(
              [
                { id: "orders", label: "Orders", icon: Package },
                { id: "settings", label: "Settings", icon: Settings },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex h-9 cursor-pointer items-center gap-2 rounded-full px-5 text-[13px] font-medium transition-colors",
                  tab === t.id ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="profile-tab"
                    className="absolute inset-0 rounded-full bg-background shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <t.icon size={14} className="relative z-10" />
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </BlurFade>

        <div className="mt-8">
          <AnimatePresence mode="wait" initial={false}>
            {tab === "orders" ? (
              <motion.div
                key="orders"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {orders.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-line py-20 text-center">
                    <ShoppingBag size={26} className="text-faint" />
                    <div>
                      <p className="font-medium">No orders yet</p>
                      <p className="mt-1 text-sm text-muted">Your order history and tracking will live here.</p>
                    </div>
                    <Link href="/products" transitionTypes={["nav-forward"]} className={buttonClasses("dark")}>
                      Start shopping
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order, i) => (
                      <OrderCard key={order.id} order={order} index={i} />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <form onSubmit={saveProfile} className="space-y-8">
                  <section className="rounded-card border border-line p-5 md:p-6">
                    <h2 className="text-base font-semibold">Account</h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">Display name</span>
                        <Input value={profile.name} onChange={set("name")} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">Email</span>
                        <Input type="email" value={profile.email} onChange={set("email")} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-muted">Phone</span>
                        <Input type="tel" value={profile.phone} onChange={set("phone")} placeholder="Optional" />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-card border border-line p-5 md:p-6">
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <Truck size={16} className="text-accent-ink" /> Default shipping address
                    </h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-muted">Full name</span>
                        <Input value={profile.fullName} onChange={set("fullName")} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-muted">Address</span>
                        <Input value={profile.line1} onChange={set("line1")} placeholder="Street and number" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">City</span>
                        <Input value={profile.city} onChange={set("city")} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">Postcode</span>
                        <Input value={profile.postcode} onChange={set("postcode")} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-muted">Country</span>
                        <Select value={profile.country} onChange={set("country")}>
                          {["Ireland", "Germany", "France", "Netherlands", "Spain", "Italy", "Belgium"].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </Select>
                      </label>
                    </div>
                  </section>

                  <div className="flex items-center gap-3">
                    <Button type="submit">Save changes</Button>
                    <p className="flex items-center gap-1.5 text-xs text-faint">
                      <PackageCheck size={13} /> Stored locally in this browser only
                    </p>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </NavTransition>
  );
}