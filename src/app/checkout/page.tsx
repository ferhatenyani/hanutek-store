"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Banknote, ChevronLeft, CreditCard, Landmark, Lock, ShieldCheck, Truck, Zap } from "lucide-react";
import { useStore, cartTotals, promoDiscountRate } from "@/lib/store";
import { getProduct, variantPrice } from "@/lib/products";
import { WILAYAS } from "@/lib/wilayas";
import { useI18n } from "@/i18n";
import { Button, buttonClasses, Spinner, Input, Select } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { NavTransition } from "@/components/nav-transition";

const EXPRESS_FEE = 900; // DZD
type Pay = "cod" | "ccp" | "card";
type Values = Record<string, string>;

function SectionTitle({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-3 text-base font-semibold">
      <span className="num font-mono text-xs font-normal text-faint">{n}</span>
      {children}
    </h2>
  );
}

function RadioCard({
  active, onClick, icon, title, sub, right,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub?: string; right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-start transition-all duration-200 ${
        active ? "border-foreground bg-surface" : "border-line bg-background hover:border-faint"
      }`}
    >
      <span className="flex items-center gap-3">
        <span className={active ? "text-foreground" : "text-muted"}>{icon}</span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          {sub && <span className="block text-xs text-muted">{sub}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {right}
        <span className={`grid h-5 w-5 place-items-center rounded-full border-2 transition-colors ${active ? "border-foreground" : "border-line"}`}>
          {active && <span className="h-2.5 w-2.5 rounded-full bg-foreground" />}
        </span>
      </span>
    </button>
  );
}

function OrderSummary({ shipping }: { shipping: number }) {
  const { m, price: fmt } = useI18n();
  const { cart, promo } = useStore();
  const base = cartTotals(cart, promoDiscountRate(promo));
  const total = base.subtotal - base.discount + shipping;
  const vlabel = (slug: string, id: string) =>
    (m.products[slug as keyof typeof m.products] as { variants: Record<string, string> }).variants[id];
  return (
    <div className="rounded-card border border-line bg-surface/50 p-6">
      <h2 className="text-base font-semibold">{m.checkout.orderSummary}</h2>
      <ul className="mt-5 space-y-4">
        {cart.map((item) => {
          const p = getProduct(item.productId);
          if (!p) return null;
          return (
            <li key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
                <Image src={p.image} alt={p.name} fill sizes="56px" className="object-cover" />
                <span className="num absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 font-mono text-[10px] text-background">
                  {item.qty}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span dir="ltr" className="block text-sm font-medium leading-snug rtl:text-right line-clamp-2">{p.name}</span>
                <span className="block truncate text-xs text-muted">{vlabel(p.slug, item.variantId)}</span>
              </span>
              <span dir="ltr" className="num font-mono text-sm">{fmt(variantPrice(p, item.variantId) * item.qty)}</span>
            </li>
          );
        })}
      </ul>
      <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{m.cart.subtotal}</dt>
          <dd dir="ltr" className="num font-mono">{fmt(base.subtotal)}</dd>
        </div>
        {base.discount > 0 && (
          <div className="flex justify-between text-accent-ink">
            <dt>{m.cart.discount} ({promo})</dt>
            <dd dir="ltr" className="num font-mono">−{fmt(base.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">{m.cart.shipping}</dt>
          <dd dir="ltr" className="num font-mono">{shipping === 0 ? m.product.free : fmt(shipping)}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <dt className="font-medium">{m.cart.total}</dt>
          <dd dir="ltr" className="num font-display text-lg font-semibold">{fmt(total)}</dd>
        </div>
      </dl>
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-faint">
        <ShieldCheck size={12} /> {m.product.mockNote}
      </p>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { m, price: fmt, locale } = useI18n();
  const { cart, cartCount, promo, user, placeOrder, ready } = useStore();
  const [delivery, setDelivery] = useState<"standard" | "express">("standard");
  const [pay, setPay] = useState<Pay>("cod");
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState<Values>({});
  const [values, setValues] = useState<Values>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: "",
    address: "",
    commune: "",
    wilaya: "",
    postalCode: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    cardName: "",
  });

  const base = cartTotals(cart, promoDiscountRate(promo));
  const shipping = delivery === "express" ? EXPRESS_FEE : base.shipping;
  const total = base.subtotal - base.discount + shipping;

  const set = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((s) => ({ ...s, [k]: "" }));
  };

  const validate = (): boolean => {
    const e: Values = {};
    const req = m.checkout.required;
    if (!values.name.trim()) e.name = req;
    if (!values.phone.trim()) e.phone = req;
    else if (!/^[+\d][\d\s]{7,}$/.test(values.phone.trim())) e.phone = m.checkout.invalidPhone;
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e.email = m.checkout.invalidEmail;
    if (!values.address.trim()) e.address = req;
    if (!values.commune.trim()) e.commune = req;
    if (!values.wilaya) e.wilaya = req;
    if (pay === "card") {
      if (values.cardNumber.replace(/\s/g, "").length < 12) e.cardNumber = req;
      if (!/^\d{2}\s?\/\s?\d{2}$/.test(values.cardExpiry)) e.cardExpiry = req;
      if (values.cardCvc.length < 3) e.cardCvc = req;
      if (!values.cardName.trim()) e.cardName = req;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (placing || !validate()) return;
    setPlacing(true);
    const last4 = values.cardNumber.replace(/\s/g, "").slice(-4);
    const payment =
      pay === "cod" ? m.checkout.cod : pay === "ccp" ? m.checkout.ccp : `${m.checkout.card} ···· ${last4}`;
    window.setTimeout(() => {
      const order = placeOrder({
        address: {
          fullName: values.name,
          line1: values.address,
          city: values.commune,
          postcode: values.postalCode,
          country: locale === "ar" ? "الجزائر" : "Algérie",
          wilaya: values.wilaya,
          phone: values.phone,
        },
        payment,
        discount: base.discount,
        shippingOverride: shipping,
      });
      router.push(`/order/${order.id}`);
    }, 1100);
  };

  if (ready && cart.length === 0 && !placing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-28 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{m.cart.empty}</h1>
        <p className="mt-2 text-sm text-muted">{m.cart.emptyBody}</p>
        <Link href="/products" className={buttonClasses("dark", "lg", "mt-8")}>
          {m.cart.startShopping}
        </Link>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6" aria-busy="true">
        <div className="h-9 w-44 animate-pulse rounded-lg bg-line" />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-line" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-card bg-line" />
        </div>
      </div>
    );
  }

  return (
    <NavTransition>
      <div className="mx-auto max-w-6xl px-4 py-10 pb-40 md:px-6 md:py-14 md:pb-14">
        <BlurFade duration={0.4}>
          <Link
            href="/cart"
            transitionTypes={["nav-back"]}
            className="mb-6 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            <ChevronLeft size={13} className="rtl:rotate-180" /> {m.checkout.backToCart}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{m.checkout.title}</h1>
          {!user && (
            <p className="mt-2 text-sm text-muted">
              {m.checkout.guestNote}{" "}
              <Link href="/login" className="font-medium text-accent-ink underline underline-offset-2">
                {m.auth.loginCta}
              </Link>
            </p>
          )}
        </BlurFade>

        <form id="checkout-form" onSubmit={submit} noValidate className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-9">
            <BlurFade delay={0.05}>
              <section aria-label={m.checkout.contact}>
                <SectionTitle n="01">{m.checkout.contact}</SectionTitle>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label={m.auth.name} error={errors.name} name="name" value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
                  <Input label={m.checkout.phone} error={errors.phone} name="phone" dir="ltr" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0550 00 00 00" autoComplete="tel" inputMode="tel" />
                  <div className="sm:col-span-2">
                    <Input label={m.checkout.email} error={errors.email} name="email" dir="ltr" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
                  </div>
                </div>
              </section>
            </BlurFade>

            <BlurFade delay={0.1}>
              <section aria-label={m.checkout.shippingInfo}>
                <SectionTitle n="02">{m.checkout.shippingInfo}</SectionTitle>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Input label={m.checkout.address} error={errors.address} name="address" value={values.address} onChange={(e) => set("address", e.target.value)} placeholder={m.checkout.addressPlaceholder} autoComplete="street-address" />
                  </div>
                  <Input label={m.checkout.city} error={errors.commune} name="commune" value={values.commune} onChange={(e) => set("commune", e.target.value)} autoComplete="address-level2" />
                  <div>
                    <Select label={m.checkout.wilaya} name="wilaya" value={values.wilaya} onChange={(e) => set("wilaya", e.target.value)} className={errors.wilaya ? "border-danger" : undefined}>
                      <option value="">{m.checkout.wilayaPlaceholder}</option>
                      {WILAYAS.map((w) => (
                        <option key={w.code} value={w.code}>{w.code} — {w[locale]}</option>
                      ))}
                    </Select>
                    {errors.wilaya && <p className="mt-1.5 text-xs text-danger">{errors.wilaya}</p>}
                  </div>
                  <Input label={m.checkout.postalCode} name="postalCode" dir="ltr" value={values.postalCode} onChange={(e) => set("postalCode", e.target.value)} autoComplete="postal-code" inputMode="numeric" />
                </div>
              </section>
            </BlurFade>

            <BlurFade delay={0.15}>
              <section aria-label={m.checkout.delivery}>
                <SectionTitle n="03">{m.checkout.delivery}</SectionTitle>
                <div role="radiogroup" aria-label={m.checkout.delivery} className="mt-4 space-y-2.5">
                  <RadioCard
                    active={delivery === "standard"}
                    onClick={() => setDelivery("standard")}
                    icon={<Truck size={17} />}
                    title={m.checkout.standard}
                    sub={m.checkout.standardEta}
                    right={<span dir="ltr" className="num font-mono text-sm">{base.shipping === 0 ? m.product.free : fmt(base.shipping)}</span>}
                  />
                  <RadioCard
                    active={delivery === "express"}
                    onClick={() => setDelivery("express")}
                    icon={<Zap size={17} />}
                    title={m.checkout.express}
                    sub={m.checkout.expressEta}
                    right={<span dir="ltr" className="num font-mono text-sm">{fmt(EXPRESS_FEE)}</span>}
                  />
                </div>
              </section>
            </BlurFade>

            <BlurFade delay={0.2}>
              <section aria-label={m.checkout.payment}>
                <SectionTitle n="04">{m.checkout.payment}</SectionTitle>
                <div role="radiogroup" aria-label={m.checkout.payment} className="mt-4 space-y-2.5">
                  <RadioCard active={pay === "cod"} onClick={() => setPay("cod")} icon={<Banknote size={17} />} title={m.checkout.cod} sub={m.checkout.codNote} />
                  <RadioCard active={pay === "ccp"} onClick={() => setPay("ccp")} icon={<Landmark size={17} />} title={m.checkout.ccp} sub={m.checkout.ccpNote} />
                  <RadioCard active={pay === "card"} onClick={() => setPay("card")} icon={<CreditCard size={17} />} title={m.checkout.card} sub={m.checkout.cardMockNote} />
                </div>
                <AnimatePresence initial={false}>
                  {pay === "card" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 grid gap-4 rounded-xl border border-line bg-surface/40 p-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Input label={m.checkout.cardNumber} error={errors.cardNumber} name="cardNumber" dir="ltr" inputMode="numeric" placeholder="4242 4242 4242 4242" value={values.cardNumber} onChange={(e) => set("cardNumber", e.target.value)} className="font-mono" />
                        </div>
                        <Input label={m.checkout.expiry} error={errors.cardExpiry} name="cardExpiry" dir="ltr" placeholder="MM/YY" value={values.cardExpiry} onChange={(e) => set("cardExpiry", e.target.value)} className="font-mono" />
                        <Input label={m.checkout.cvc} error={errors.cardCvc} name="cardCvc" dir="ltr" inputMode="numeric" placeholder="123" maxLength={4} value={values.cardCvc} onChange={(e) => set("cardCvc", e.target.value)} className="font-mono" />
                        <div className="sm:col-span-2">
                          <Input label={m.checkout.holder} error={errors.cardName} name="cardName" value={values.cardName} onChange={(e) => set("cardName", e.target.value)} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </BlurFade>

            <BlurFade delay={0.25} className="hidden md:block">
              {Object.values(errors).some(Boolean) && (
                <p className="mb-3 text-sm text-danger">{m.checkout.checkFields}</p>
              )}
              <Button type="submit" size="lg" disabled={placing} className="w-full sm:w-auto sm:min-w-72">
                {placing ? (
                  <>
                    <Spinner /> {m.checkout.processing}
                  </>
                ) : (
                  <>
                    {m.checkout.placeOrder} · <span dir="ltr" className="num">{fmt(total)}</span> <ArrowRight size={16} className="rtl:rotate-180" />
                  </>
                )}
              </Button>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
                <Lock size={12} /> {m.product.mockNote}
              </p>
            </BlurFade>
          </div>

          <BlurFade delay={0.15} className="lg:sticky lg:top-24">
            <OrderSummary shipping={shipping} />
          </BlurFade>
        </form>

        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-background/90 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-faint">{m.cart.total} ({cartCount})</p>
              <p dir="ltr" className="num font-display text-lg font-semibold">{fmt(total)}</p>
            </div>
            <Button type="submit" form="checkout-form" size="lg" disabled={placing}>
              {placing ? <Spinner /> : m.checkout.placeOrder}
            </Button>
          </div>
        </div>
      </div>
    </NavTransition>
  );
}
