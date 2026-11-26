"use client";

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Promo-code form / applied chip — shared by the cart page and the
 *  expanded cart sheet so both surfaces behave identically. */
export function CartPromo() {
  const { m, price } = useI18n();
  const { promo, cart, applyPromo, removePromo } = useStore();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await applyPromo(code.trim());
    setBusy(false);
    if (res.ok) {
      setCode("");
      setCodeError(null);
      toast(`${code.trim().toUpperCase()} · ${m.cart.promoApplied}`);
    } else {
      setCodeError(reasonText(res.reason));
    }
  };
  /** Server eligibility reason → shopper-facing explanation. */
  function reasonText(reason: string) {
    switch (reason) {
      case "min_subtotal":
        return m.cart.promoMinSubtotal;
      case "expired":
        return m.cart.promoExpired;
      case "inactive":
        return m.cart.promoInactive;
      case "not_started":
        return m.cart.promoNotStarted;
      case "exhausted":
        return m.cart.promoExhausted;
      case "per_user":
        return m.cart.promoPerUser;
      case "network":
      case "RATE_LIMITED":
        return reason === "RATE_LIMITED" ? m.common.tooMany : m.common.actionFailed;
      default:
        return m.cart.promoInvalid;
    }
  }
  const promoLabel = cart.promo ? (cart.promo.type === "percent" ? `−${cart.promo.value} %` : `−${price(cart.promo.value)}`) : "";

  if (promo) {
    const why = cart.promo?.ineligible;
    return (
      <div className={cn("rounded-card border px-4 py-2.5", why ? "border-line bg-accent-soft/60" : "border-volt/60 bg-volt-soft")}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-accent-ink">
            <Tag size={15} className="shrink-0" aria-hidden />
            <span className="font-mono font-bold">{promo}</span>
            {!why && (
              <span className="truncate">
                · {m.cart.promoApplied} (<span dir="ltr">{promoLabel}</span>)
              </span>
            )}
          </span>
          <button
            type="button"
            aria-label={`${m.cart.remove} ${promo}`}
            onClick={() => void removePromo().catch(() => toast(m.common.actionFailed))}
            className="-me-2 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-white/60 hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>
        {why && (
          <p role="status" className="pb-1 text-xs text-danger">
            {why === "min_subtotal" && cart.promo
              ? m.cart.promoMinSubtotalAmount.replace("{amount}", price(cart.promo.minSubtotal))
              : m.cart.promoNotEligibleNow.replace("{reason}", reasonText(why).toLowerCase())}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={submitPromo}
      className="rounded-card border border-line bg-accent-soft/60 p-4"
      aria-label={m.cart.promoTitle}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Tag size={15} className="text-accent-ink" aria-hidden /> {m.cart.promoTitle}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {m.cart.promoHelp.split("DRIVE10")[0]}
        <code className="mx-0.5 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent-ink">DRIVE10</code>
        {m.cart.promoHelp.split("DRIVE10")[1]}
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeError(null);
          }}
          placeholder={m.cart.promoPlaceholder}
          aria-label={m.cart.promoPlaceholder}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className={cn(
            "h-11 min-w-0 flex-1 rounded-control border bg-surface px-3.5 font-mono text-sm uppercase text-foreground placeholder:font-sans placeholder:normal-case placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
            codeError ? "border-danger" : "border-line",
          )}
        />
        <Button type="submit" disabled={!code.trim() || busy} className="shrink-0 px-5">
          {m.cart.promoApply}
        </Button>
      </div>
      {codeError && <p role="alert" className="mt-2 text-xs text-danger">{codeError}</p>}
    </form>
  );
}
