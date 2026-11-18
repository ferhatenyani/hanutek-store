"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banknote, Lock, Truck, Zap } from "lucide-react";
import { useStore, cartTotals, promoDiscountRate } from "@/lib/store";
import { WILAYAS } from "@/lib/wilayas";
import { useI18n } from "@/i18n";
import { Button, Spinner, Input } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/select-menu";
import { stampNav } from "@/components/nav-transition";

const EXPRESS_FEE = 900; // DZD
type Values = Record<string, string>;

function SectionTitle({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-3 text-base font-semibold">
      <span className="num font-mono text-xs font-normal text-faint">{n}</span>
      {children}
    </h2>
  );
}

function cnInputError(err?: string) {
  return err ? "border-danger" : undefined;
}

function DeliveryCard({
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
      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-start transition-colors duration-150 ${
        active ? "border-foreground bg-accent-soft/50" : "border-line bg-surface hover:border-faint"
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

/**
 * The checkout form (A3): lives BELOW the cart lines — on the /cart page and
 * inside the expanded bottom sheet — so "Proceed to checkout" is a pure
 * scroll within one continuous document; nothing here remounts or animates.
 * Only delivery + contact/shipping fields + payment live here: the totals
 * summary shown above the cart is the single source for money. Submitting
 * places the order and pushes the confirmation with a directional pop.
 *
 * `onNavigatedAway` lets the cart sheet close itself right before the push
 * so its snapshot never overlaps the confirmation page.
 */
export function CheckoutForm({ onNavigatedAway }: { onNavigatedAway?: () => void }) {
  const router = useRouter();
  const { m, price: fmt, locale } = useI18n();
  const { cart, promo, user, placeOrder, ready } = useStore();
  const [delivery, setDelivery] = useState<"standard" | "express">("standard");
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
  });

  // Prefill contact details once the persisted user hydrates — `user` is null
  // on the first render, so the initializer above can't see it. Render-phase
  // sync fills only fields the shopper hasn't already typed.
  const [prefilled, setPrefilled] = useState(false);
  if (ready && user && !prefilled) {
    setPrefilled(true);
    setValues((v) => ({ ...v, name: v.name || user.name, email: v.email || user.email }));
  }

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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (placing || !validate()) return;
    setPlacing(true);
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
        payment: m.checkout.cod,
        discount: base.discount,
        shippingOverride: shipping,
      });
      onNavigatedAway?.();
      stampNav(window.location.pathname, `/order/${order.id}`, "nav-forward");
      router.push(`/order/${order.id}`, { transitionTypes: ["nav-forward"] });
    }, 900);
  };

  return (
    <form onSubmit={submit} noValidate className="mt-8">
      <div className="space-y-9">
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

        <section aria-label={m.checkout.shippingInfo}>
          <SectionTitle n="02">{m.checkout.shippingInfo}</SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label={m.checkout.address} error={errors.address} name="address" value={values.address} onChange={(e) => set("address", e.target.value)} placeholder={m.checkout.addressPlaceholder} autoComplete="street-address" />
            </div>
            <Input label={m.checkout.city} error={errors.commune} name="commune" value={values.commune} onChange={(e) => set("commune", e.target.value)} autoComplete="address-level2" />
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-foreground">{m.checkout.wilaya}</p>
              <SelectMenu
                ariaLabel={m.checkout.wilaya}
                value={values.wilaya}
                onChange={(v) => set("wilaya", v)}
                options={[
                  { value: "", label: m.checkout.wilayaPlaceholder },
                  ...WILAYAS.map((w) => ({ value: w.code, label: `${w.code} — ${w[locale]}` })),
                ]}
                buttonClassName={cnInputError(errors.wilaya)}
                align="start"
              />
              {errors.wilaya && <p className="mt-1.5 text-xs text-danger">{errors.wilaya}</p>}
            </div>
            <Input label={m.checkout.postalCode} name="postalCode" dir="ltr" value={values.postalCode} onChange={(e) => set("postalCode", e.target.value)} autoComplete="postal-code" inputMode="numeric" />
          </div>
        </section>

        <section aria-label={m.checkout.delivery}>
          <SectionTitle n="03">{m.checkout.delivery}</SectionTitle>
          <div role="radiogroup" aria-label={m.checkout.delivery} className="mt-4 space-y-2.5">
            <DeliveryCard
              active={delivery === "standard"}
              onClick={() => setDelivery("standard")}
              icon={<Truck size={17} />}
              title={m.checkout.standard}
              sub={m.checkout.standardEta}
              right={<span dir="ltr" className="num font-mono text-sm">{fmt(base.shipping)}</span>}
            />
            <DeliveryCard
              active={delivery === "express"}
              onClick={() => setDelivery("express")}
              icon={<Zap size={17} />}
              title={m.checkout.express}
              sub={m.checkout.expressEta}
              right={<span dir="ltr" className="num font-mono text-sm">{fmt(EXPRESS_FEE)}</span>}
            />
          </div>
        </section>

        <section aria-label={m.checkout.payment}>
          <SectionTitle n="04">{m.checkout.payment}</SectionTitle>
          {/* Cash on delivery is the only payment method — shown as a settled fact */}
          <div className="mt-4 rounded-xl border border-foreground/25 bg-accent-soft/60 px-4 py-4">
            <p className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-volt">
                <Banknote size={16} aria-hidden />
              </span>
              {m.checkout.cod}
            </p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{m.checkout.codNote}</p>
            <p className="mt-1.5 text-[11px] font-medium text-faint">{m.checkout.onlyPayment}</p>
          </div>
        </section>

        <div>
          {!user && ready && (
            <p className="mb-5 text-sm text-muted">
              {m.checkout.guestNote}{" "}
              <Link href="/login" transitionTypes={["nav-forward"]} className="font-medium text-accent-ink underline underline-offset-2">
                {m.auth.loginCta}
              </Link>
            </p>
          )}
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
                {m.checkout.placeOrder} · <span dir="ltr" className="num">{fmt(total)}</span>{" "}
                <span className="font-normal opacity-80">({m.checkout.cod})</span>
              </>
            )}
          </Button>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
            <Lock size={12} /> {m.product.mockNote}
          </p>
        </div>
      </div>
    </form>
  );
}
