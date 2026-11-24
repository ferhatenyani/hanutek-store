"use client";

import { useState } from "react";
import { adminApi, errorMessage, invalidate } from "../lib/client";
import { num } from "../lib/format";
import { Button, Field, Input, Mono, Textarea } from "../ui/core";
import { Dialog, Segmented, Select, useToast } from "../ui/overlay";

export interface StockTarget {
  variantId: string;
  sku: string;
  label: string;
  stock: number;
}

type Mode = "add" | "remove" | "set";

/** Adjust one variant's stock through the ledger endpoint (reason + note are recorded). */
export function StockDialog({ target, onClose, onDone }: { target: StockTarget | null; onClose: () => void; onDone?: (stock: number) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<"restock" | "adjustment" | "return">("restock");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!target) return null;
  const n = Number(amount);
  const valid = amount !== "" && Number.isInteger(n) && n >= 0 && (mode !== "remove" || n <= target.stock) && (mode === "set" || n > 0);
  const result = !valid ? null : mode === "add" ? target.stock + n : mode === "remove" ? target.stock - n : n;
  const close = () => {
    setAmount("");
    setNote("");
    setError(null);
    setMode("add");
    onClose();
  };
  const submit = async () => {
    if (!valid) return setError(mode === "remove" && n > target.stock ? `Only ${target.stock} in stock` : "Enter a whole number");
    setPending(true);
    try {
      const body = mode === "set" ? { set: n } : { delta: mode === "add" ? n : -n };
      const r = await adminApi<{ stock: number }>(`/admin/variants/${target.variantId}/stock`, { method: "POST", body: { ...body, reason, note: note.trim() || null } });
      invalidate("/admin/inventory", "/admin/products", "/admin/analytics");
      toast.success(`Stock updated · ${target.sku}`, `Now ${num(r.stock)} units.`);
      onDone?.(r.stock);
      close();
    } catch (err) {
      toast.error("Couldn't update stock", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onClose={close}
      size="sm"
      title="Adjust stock"
      description={
        <>
          {target.label} · <Mono>{target.sku}</Mono>
        </>
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={pending} disabled={!valid} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Segmented
          ariaLabel="Adjustment type"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setReason(m === "add" ? "restock" : "adjustment");
          }}
          options={[
            { value: "add", label: "Add" },
            { value: "remove", label: "Remove" },
            { value: "set", label: "Set to" },
          ]}
        />
        <Field label={mode === "set" ? "New quantity" : "Quantity"} htmlFor="stock-amount" error={error}>
          <Input id="stock-amount" inputMode="numeric" value={amount} onChange={(e) => (setError(null), setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 7)))} data-autofocus suffix="units" invalid={Boolean(error)} />
        </Field>
        <p className="tnum text-[13px] text-ad-muted">
          On hand: <span className="font-medium text-ad-fg">{num(target.stock)}</span>
          {result !== null && (
            <>
              {" "}
              → <span className="font-medium text-ad-fg">{num(result)}</span>
            </>
          )}
        </p>
        <Field label="Reason" htmlFor="stock-reason">
          <Select
            id="stock-reason"
            value={reason}
            onChange={setReason}
            options={[
              { value: "restock", label: "Restock (received goods)" },
              { value: "adjustment", label: "Adjustment (count, damage, loss)" },
              { value: "return", label: "Customer return" },
            ]}
          />
        </Field>
        <Field label="Note" optional>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder="e.g. Supplier delivery #412" />
        </Field>
      </form>
    </Dialog>
  );
}
