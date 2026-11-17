"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CreditCard, Loader2, Lock, Truck, Wallet, Zap } from "lucide-react";
import { useStore, cartTotals, promoDiscountRate, type Address } from "@/lib/store";
import { getProduct, variantLabel, variantPrice } from "@/lib/products";
import { cn, formatPrice } from "@/lib/utils";
import { Button, Input, Select } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { NavTransition } from "@/components/nav-transition";
import { useToast } from "@/components/ui/toast";

const EXPRESS_FEE = 9.9;
const COUNTRIES = ["Ireland", "Germany", "France", "Netherlands", "Spain", "Italy", "Belgium"];

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export default function CheckoutPage() {
  const { cart, user, promo, placeOrder, ready } = useStore();
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    email: user?.email ?? "",
    firstName: user?.address?.fullName.split(" ")[0] ?? user?.name.split(" ")[0] ?? "",
    lastName: user?.address?.fullName.split(" ").slice(1).join(" ") ?? user?.name.split(" ").slice(1).join(" ") ?? "",
    line1: user?.address?.line1 ?? "",
    city: user?.address?.city ?? "",
    postcode: user?.address?.postcode ?? "",
    country: user?.address?.country ?? "Ireland",
    phone: user?.phone ?? "",
  });
  const [delivery, setDelivery] = useState<"standard" | "express">("standard");
  const [payment, setPayment] = useState<"card" | "paypal">("card");
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", holder: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const doneRef = useRef<HTMLAnchorElement>(null);

  const base = cartTotals(cart, promoDiscountRate(promo));
  const shipping = delivery === "express" ? EXPRESS_FEE : base.shipping;
  const total = Math.max(0, base.subtotal - base.discount + shipping);

  useEffect(() => {
    if (ready && cart.length === 0 && !confirmedId) router.replace("/cart");
  }, [ready, cart.length, confirmedId, router]);

  useEffect(() => {
    if (confirmedId) doneRef.current?.click();
  }, [confirmedId]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: "" }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) er.email = "Enter a valid email";
    if (!form.firstName.trim()) er.firstName = "Required";
    if (!form.lastName.trim()) er.lastName = "Required";
    if (!form.line1.trim()) er.line1 = "Required";
    if (!form.city.trim()) er.city = "Required";
    if (!form.postcode.trim()) er.postcode = "Required";
    if (payment === "card") {
      if (card.number.replace(/\s/g, "").length < 15) er.number = "Enter a valid card number";
      if (!/^\d{2}\/\d{2}$/.test(card.expiry)) er.expiry = "MM/YY";
      if (card.cvc.length < 3) er.cvc = "3–4 digits";
      if (!card.holder.trim()) er.holder = "Required";
    }
    setErrors(er);
    if (Object.keys(er).length > 0) {
      toast("Check the highlighted fields");
      return;
    }
    setPlacing(true);
    const address: Address = {
      fullName: `${form.firstName} ${form.lastName}`.trim(),
      line1: form.line1,
      city: form.city,
      postcode: form.postcode,
      country: form.country,
    };
    window.setTimeout(() => {
      const order = placeOrder({
        address,
        payment: payment === "card" ? `Card ending ${card.number.replace(/\s/g, "").slice(-4)}` : "PayPal (mock)",
        discount: base.discount,
        shippingOverride: delivery === "express" ? EXPRESS_FEE : undefined,
      });
      setConfirmedId(order.id);
    }, 900);
  };

  if (!ready || (cart.length === 0 && !confirmedId)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-6">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  return (
    <NavTransition>
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-40 md:px-6 md:py-14">
        <BlurFade duration={0.4}>
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/cart" transitionTypes={["nav-back"]} className="flex items-center gap-1 transition-colors hover:text-foreground">
              <ChevronLeft size={13} /> Back to cart
            </Link>
          </nav>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Checkout</h1>
          {!user && (
            <p className="mt-2 text-sm text-muted">
              Checking out as guest.{" "}
              <Link href="/login?next=/checkout" transitionTypes={["nav-forward"]} className="text-accent-ink hover:underline">
                Sign in
              </Link>{" "}
              to autofill your details.
            </p>
          )}
        </BlurFade>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <form id="checkout-form" onSubmit={submit} className="space-y-10" noValidate>
            <BlurFade delay={0.05}>
              <section>
                <h2 className="mb-4 flex items-baseline gap-3 text-base font-semibold">
                  <span className="font-mono text-xs text-accent-ink">01</span> Contact
                </h2>
                <Field label="Email" error={errors.email}>
                  <Input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" />
                </Field>
              </section>
            </BlurFade>

            <BlurFade delay={0.1}>
              <section>
                <h2 className="mb-4 flex items-baseline gap-3 text-base font-semibold">
                  <span className="font-mono text-xs text-accent-ink">02</span> Shipping address
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" error={errors.firstName}>
                    <Input value={form.firstName} onChange={set("firstName")} autoComplete="given-name" />
                  </Field>
                  <Field label="Last name" error={errors.lastName}>
                    <Input value={form.lastName} onChange={set("lastName")} autoComplete="family-name" />
                  </Field>
                  <Field label="Address" error={errors.line1} className="sm:col-span-2">
                    <Input value={form.line1} onChange={set("line1")} placeholder="Street and number" autoComplete="street-address" />
                  </Field>
                  <Field label="City" error={errors.city}>
                    <Input value={form.city} onChange={set("city")} autoComplete="address-level2" />
                  </Field>
                  <Field label="Postcode" error={errors.postcode}>
                    <Input value={form.postcode} onChange={set("postcode")} autoComplete="postal-code" />
                  </Field>
                  <Field label="Country">
                    <Select value={form.country} onChange={set("country")} autoComplete="country-name">
                      {COUNTRIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Phone (optional)">
                    <Input value={form.phone} onChange={set("phone")} type="tel" autoComplete="tel" />
                  </Field>
                </div>
              </section>
            </BlurFade>

            <BlurFade delay={0.15}>
              <section>
                <h2 className="mb-4 flex items-baseline gap-3 text-base font-semibold">
                  <span className="font-mono text-xs text-accent-ink">03</span> Delivery
                </h2>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery method">
                  {(
                    [
                      { id: "standard", icon: Truck, title: "Standard", eta: "3–5 working days", price: base.shipping },
                      { id: "express", icon: Zap, title: "Express", eta: "1–2 working days", price: EXPRESS_FEE },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={delivery === d.id}
                      onClick={() => setDelivery(d.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                        delivery === d.id ? "border-accent bg-accent-soft/60" : "border-line hover:border-foreground/30",
                      )}
                    >
                      <d.icon size={18} className={delivery === d.id ? "text-accent-ink" : "text-muted"} />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{d.title}</span>
                        <span className="block text-xs text-muted">{d.eta}</span>
                      </span>
                      <span className="font-mono text-sm">{d.price === 0 ? "Free" : formatPrice(d.price)}</span>
                    </button>
                  ))}
                </div>
              </section>
            </BlurFade>

            <BlurFade delay={0.2}>
              <section>
                <h2 className="mb-4 flex items-baseline gap-3 text-base font-semibold">
                  <span className="font-mono text-xs text-accent-ink">04</span> Payment
                </h2>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                  {(
                    [
                      { id: "card", icon: CreditCard, title: "Card", sub: "Mock — use any digits" },
                      { id: "paypal", icon: Wallet, title: "PayPal", sub: "Mock redirect" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={payment === m.id}
                      onClick={() => setPayment(m.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                        payment === m.id ? "border-accent bg-accent-soft/60" : "border-line hover:border-foreground/30",
                      )}
                    >
                      <m.icon size={18} className={payment === m.id ? "text-accent-ink" : "text-muted"} />
                      <span>
                        <span className="block text-sm font-medium">{m.title}</span>
                        <span className="block text-xs text-muted">{m.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {payment === "card" && (
                  <div className="mt-4 grid gap-4 rounded-xl border border-line bg-surface/50 p-4 sm:grid-cols-2">
                    <Field label="Card number" error={errors.number} className="sm:col-span-2">
                      <Input
                        inputMode="numeric"
                        placeholder="4242 4242 4242 4242"
                        value={card.number}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
                          setCard((c) => ({ ...c, number: digits.replace(/(.{4})/g, "$1 ").trim() }));
                          setErrors((er) => ({ ...er, number: "" }));
                        }}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Expiry" error={errors.expiry}>
                      <Input
                        inputMode="numeric"
                        placeholder="MM/YY"
                        value={card.expiry}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setCard((c) => ({ ...c, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                          setErrors((er) => ({ ...er, expiry: "" }));
                        }}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="CVC" error={errors.cvc}>
                      <Input
                        inputMode="numeric"
                        placeholder="123"
                        value={card.cvc}
                        onChange={(e) => {
                          setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }));
                          setErrors((er) => ({ ...er, cvc: "" }));
                        }}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Name on card" error={errors.holder} className="sm:col-span-2">
                      <Input value={card.holder} onChange={(e) => setCard((c) => ({ ...c, holder: e.target.value }))} />
                    </Field>
                  </div>
                )}
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
                  <Lock size={11} /> This is a frontend demo — no payment is processed and no data leaves your browser.
                </p>
              </section>
            </BlurFade>
          </form>

          <BlurFade delay={0.15} className="h-fit lg:sticky lg:top-24">
            <div className="rounded-card border border-line bg-surface/50 p-6">
              <h2 className="text-base font-semibold">Order summary</h2>
              <ul className="mt-4 space-y-3">
                {cart.map((item) => {
                  const p = getProduct(item.productId);
                  if (!p) return null;
                  return (
                    <li key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3">
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-background">
                        <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{p.name}</span>
                        <span className="block text-[11px] text-muted">
                          {variantLabel(p, item.variantId)} × {item.qty}
                        </span>
                      </span>
                      <span className="font-mono text-[13px]">{formatPrice(variantPrice(p, item.variantId) * item.qty)}</span>
                    </li>
                  );
                })}
              </ul>
              <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="font-mono">{formatPrice(base.subtotal)}</dd>
                </div>
                {base.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>Discount ({promo})</dt>
                    <dd className="font-mono">−{formatPrice(base.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted">Shipping ({delivery})</dt>
                  <dd className="font-mono">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-mono text-lg font-semibold">{formatPrice(total)}</dd>
                </div>
              </dl>
              <Button type="submit" form="checkout-form" size="lg" className="mt-6 w-full gap-2" disabled={placing}>
                {placing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Lock size={15} /> Place order · {formatPrice(total)}
                  </>
                )}
              </Button>
            </div>
          </BlurFade>
        </div>

        {/* Mobile sticky order bar — keeps the total + action in thumb reach */}
        {!confirmedId && (
          <div className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-background/95 px-4 py-3 backdrop-blur-sm md:hidden">
            <Button type="submit" form="checkout-form" size="lg" className="w-full gap-2" disabled={placing}>
              {placing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Lock size={15} /> Place order · {formatPrice(total)}
                </>
              )}
            </Button>
          </div>
        )}

        {confirmedId && (
          <Link
            ref={doneRef}
            href={`/order/${confirmedId}?new=1`}
            transitionTypes={["nav-forward"]}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          >
            Order confirmed
          </Link>
        )}
      </div>
    </NavTransition>
  );
}