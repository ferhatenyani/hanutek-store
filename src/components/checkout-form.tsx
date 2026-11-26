"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Banknote, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { WILAYAS } from "@/lib/wilayas";
import { useI18n } from "@/i18n";
import { Button, Spinner, Input } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/select-menu";
import { stampNav } from "@/components/nav-transition";

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

/** Server field paths → form field names. */
const FIELD_MAP: Record<string, string> = {
  "contact.name": "name",
  "contact.phone": "phone",
  "contact.email": "email",
  "address.line1": "address",
  "address.commune": "commune",
  "address.wilaya": "wilaya",
  "address.postalCode": "postalCode",
};

/**
 * The checkout form (A3): lives BELOW the cart lines — on the /cart page and
 * inside the expanded bottom sheet — so "Proceed to checkout" is a pure
 * scroll within one continuous document; nothing here remounts or animates.
 * Only contact/shipping fields + payment live here: the totals summary shown
 * above the cart is the single source for money. Submitting places the order
 * (cash on delivery, server-priced, idempotent) and pushes the confirmation.
 *
 * `onNavigatedAway` lets the cart sheet close itself right before the push
 * so its snapshot never overlaps the confirmation page.
 */
export function CheckoutForm({ onNavigatedAway }: { onNavigatedAway?: () => void }) {
  const router = useRouter();
  const { m, price: fmt, locale } = useI18n();
  const { cart, user, placeOrder, ready, reloadSession } = useStore();
  const [placing, setPlacing] = useState(false);
  // Synchronous guard: a double click / Enter-repeat fires before `placing` re-renders.
  const inFlight = useRef(false);
  const [errors, setErrors] = useState<Values>({});
  const [formError, setFormError] = useState("");
  // One key per checkout attempt: a retried/double submit can never create two orders.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [saveAddress, setSaveAddress] = useState(true);
  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    phone: "",
    address: "",
    commune: "",
    wilaya: "",
    postalCode: "",
  });

  // Prefill from the account once the session hydrates (render-phase sync,
  // only fills fields the shopper hasn't typed yet).
  const [prefilled, setPrefilled] = useState(false);
  if (ready && user && !prefilled) {
    setPrefilled(true);
    const a = user.defaultAddress;
    setSaveAddress(!a);
    setValues((v) => ({
      ...v,
      name: v.name || a?.fullName || user.name,
      email: v.email || user.email,
      phone: v.phone || a?.phone || user.phone || "",
      address: v.address || a?.line1 || "",
      commune: v.commune || a?.commune || "",
      wilaya: v.wilaya || a?.wilaya || "",
      postalCode: v.postalCode || a?.postalCode || "",
    }));
  }

  const total = cart.total;
  const blocked = cart.lines.some((l) => !l.available);

  const set = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((s) => ({ ...s, [k]: "" }));
    setFormError("");
  };

  const validate = (): boolean => {
    const e: Values = {};
    const req = m.checkout.required;
    if (values.name.trim().length < 2) e.name = req;
    const phone = values.phone.replace(/[\s.\-()]/g, "");
    if (!phone) e.phone = req;
    else if (!/^(?:\+213|00213|0)[1-9]\d{7,8}$/.test(phone)) e.phone = m.checkout.invalidPhone;
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e.email = m.checkout.invalidEmail;
    if (!values.address.trim()) e.address = req;
    if (!values.commune.trim()) e.commune = req;
    if (!values.wilaya) e.wilaya = req;
    if (values.postalCode && !/^\d{5}$/.test(values.postalCode.trim())) e.postalCode = m.checkout.invalidPostcode;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || placing || blocked || !validate()) return;
    inFlight.current = true;
    setPlacing(true);
    setFormError("");
    try {
      const { order } = await placeOrder({
        idempotencyKey,
        locale,
        contact: { name: values.name.trim(), phone: values.phone, email: values.email.trim() || null },
        address: { line1: values.address, commune: values.commune, wilaya: values.wilaya, postalCode: values.postalCode.trim() || null },
        saveAddress: Boolean(user) && saveAddress,
      });
      setIdempotencyKey(crypto.randomUUID());
      onNavigatedAway?.();
      const href = `/order/${order.number}?confirmed=1`;
      stampNav(window.location.pathname, `/order/${order.number}`, "nav-forward");
      router.push(href, { transitionTypes: ["nav-forward"] });
    } catch (err) {
      inFlight.current = false;
      setPlacing(false);
      if (!(err instanceof ApiError)) return setFormError(m.common.actionFailed);
      if (err.code === "VALIDATION" && err.fields) {
        const mapped: Values = {};
        for (const [k, v] of Object.entries(err.fields)) {
          const field = FIELD_MAP[k];
          if (field) mapped[field] = v === "invalid_phone" ? m.checkout.invalidPhone : v === "invalid_email" ? m.checkout.invalidEmail : m.checkout.required;
        }
        setErrors(mapped);
        return setFormError(m.checkout.checkFields);
      }
      if (err.code === "OUT_OF_STOCK") {
        await reloadSession().catch(() => undefined); // show which lines changed
        return setFormError(m.checkout.stockChanged);
      }
      if (err.code === "PROMO_INVALID") {
        await reloadSession().catch(() => undefined);
        return setFormError(m.checkout.promoNoLongerValid);
      }
      if (err.code === "CART_EMPTY") return setFormError(m.cart.empty);
      if (err.code === "RATE_LIMITED") return setFormError(m.common.tooMany);
      setFormError(m.common.actionFailed);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-8">
      <div className="space-y-9">
        <section aria-label={m.checkout.contact}>
          <SectionTitle n="01">{m.checkout.contact}</SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label={m.auth.name} error={errors.name} name="name" value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={120} />
            <Input label={m.checkout.phone} error={errors.phone} name="phone" dir="ltr" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0550 00 00 00" autoComplete="tel" inputMode="tel" maxLength={20} />
            <div className="sm:col-span-2">
              <Input label={m.checkout.email} error={errors.email} name="email" dir="ltr" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" maxLength={254} />
            </div>
          </div>
        </section>

        <section aria-label={m.checkout.shippingInfo}>
          <SectionTitle n="02">{m.checkout.shippingInfo}</SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label={m.checkout.address} error={errors.address} name="address" value={values.address} onChange={(e) => set("address", e.target.value)} placeholder={m.checkout.addressPlaceholder} autoComplete="street-address" maxLength={200} />
            </div>
            <Input label={m.checkout.city} error={errors.commune} name="commune" value={values.commune} onChange={(e) => set("commune", e.target.value)} autoComplete="address-level2" maxLength={80} />
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
            <Input label={m.checkout.postalCode} error={errors.postalCode} name="postalCode" dir="ltr" value={values.postalCode} onChange={(e) => set("postalCode", e.target.value)} autoComplete="postal-code" inputMode="numeric" maxLength={5} />
            {user && (
              <label className="flex cursor-pointer items-center gap-2.5 self-end pb-3 text-[13px] text-muted sm:col-span-1">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-foreground" />
                {m.checkout.saveAddress}
              </label>
            )}
          </div>
        </section>

        <section aria-label={m.checkout.payment}>
          <SectionTitle n="03">{m.checkout.payment}</SectionTitle>
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
              <Link href="/login?next=/cart%23checkout" transitionTypes={["nav-forward"]} className="font-medium text-accent-ink underline underline-offset-2">
                {m.auth.loginCta}
              </Link>
            </p>
          )}
          {(formError || Object.values(errors).some(Boolean)) && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {formError || m.checkout.checkFields}
            </p>
          )}
          {blocked && !formError && <p className="mb-3 text-sm text-danger">{m.checkout.stockChanged}</p>}
          <Button type="submit" size="lg" disabled={placing || blocked || cart.lines.length === 0} className="w-full sm:w-auto sm:min-w-72">
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
            <ShieldCheck size={12} /> {m.checkout.confirmCallNote}
          </p>
        </div>
      </div>
    </form>
  );
}
