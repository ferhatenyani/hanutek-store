"use client";

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { PROMO_CODE } from "@/lib/products";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Promo-code form / applied chip — shared by the cart page and the
 *  expanded cart sheet so both surfaces behave identically. */
export function CartPromo() {
  const { m } = useI18n();
  const { promo, applyPromo, removePromo } = useStore();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  const submitPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (applyPromo(code)) {
      setCode("");
      setCodeError(false);
      toast(`${PROMO_CODE} · ${m.cart.promoApplied}`);
    } else {
      setCodeError(true);
    }
  };

  if (promo) {
    return (
      <div className="flex items-center justify-between rounded-card border border-volt/60 bg-volt-soft px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-medium text-accent-ink">
          <Tag size={15} aria-hidden />
          <span className="font-mono font-bold">{promo}</span> · {m.cart.promoApplied} (−10 %)
        </span>
        <button
          type="button"
          aria-label={m.cart.remove}
          onClick={removePromo}
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-white/60 hover:text-foreground"
        >
          <X size={15} />
        </button>
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
            setCodeError(false);
          }}
          placeholder={m.cart.promoPlaceholder}
          aria-label={m.cart.promoPlaceholder}
          autoCapitalize="characters"
          className={cn(
            "h-11 min-w-0 flex-1 rounded-control border bg-surface px-3.5 font-mono text-sm uppercase text-foreground placeholder:font-sans placeholder:normal-case placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
            codeError ? "border-danger" : "border-line",
          )}
        />
        <Button type="submit" disabled={!code.trim()} className="shrink-0 px-5">
          {m.cart.promoApply}
        </Button>
      </div>
      {codeError && <p className="mt-2 text-xs text-danger">{m.cart.promoInvalid}</p>}
    </form>
  );
}
