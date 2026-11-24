"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Pencil, Plus, TicketPercent, Trash2 } from "lucide-react";
import { ApiError, adminApi, errorMessage, invalidate, useApi } from "../lib/client";
import { dzd, fmtDate, fmtDateTime, num } from "../lib/format";
import { ORDER_STATUS, type Tone } from "../lib/meta";
import type { Promotion, PromotionDetail } from "../lib/types";
import { useUrlState } from "../data/state";
import { DataTable, type Column } from "../data/table";
import { SearchBox, Toolbar } from "../data/toolbar";
import { Badge, Button, Card, EmptyState, Field, Input, Mono, PageHeader, Switch, Textarea } from "../ui/core";
import { Drawer, Segmented, Tabs, useConfirm, useToast } from "../ui/overlay";
import { DatePicker } from "../ui/date-picker";

type PromoState = "active" | "scheduled" | "expired" | "paused" | "exhausted";
const STATE: Record<PromoState, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  scheduled: { label: "Scheduled", tone: "blue" },
  expired: { label: "Expired", tone: "neutral" },
  paused: { label: "Paused", tone: "amber" },
  exhausted: { label: "Used up", tone: "neutral" },
};

export function promoState(p: Promotion, now = Date.now()): PromoState {
  if (!p.isActive) return "paused";
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return "expired";
  if (p.usageLimit !== null && p.usedCount >= p.usageLimit) return "exhausted";
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return "scheduled";
  return "active";
}

const describe = (p: Pick<Promotion, "type" | "value" | "maxDiscount" | "minSubtotal">) =>
  `${p.type === "percent" ? `${p.value}% off` : `${dzd(p.value)} off`}${p.maxDiscount ? ` (max ${dzd(p.maxDiscount)})` : ""}${p.minSubtotal ? ` · orders over ${dzd(p.minSubtotal)}` : ""}`;

export function PromotionsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { state, set } = useUrlState({ tab: "", q: "", new: "", id: "" });
  const q = useApi<{ items: Promotion[] }>("/admin/promotions");
  const [editing, setEditing] = useState<Promotion | "new" | null>(null);

  useEffect(() => {
    // deep links: ?new=1 (command palette) and ?id=… (open details)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open from URL
    if (state.new) setEditing("new");
  }, [state.new]);
  const viewing = state.id ? q.data?.items.find((p) => p.id === state.id) : undefined;

  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    return all.filter((p) => (!state.tab || promoState(p) === state.tab) && (!state.q || p.code.includes(state.q.toUpperCase()) || (p.description ?? "").toLowerCase().includes(state.q.toLowerCase())));
  }, [q.data, state.tab, state.q]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of q.data?.items ?? []) c[promoState(p)] = (c[promoState(p)] ?? 0) + 1;
    return c;
  }, [q.data]);

  const toggle = async (p: Promotion, isActive: boolean) => {
    try {
      await adminApi(`/admin/promotions/${p.id}`, { method: "PATCH", body: { isActive } });
      invalidate("/admin/promotions");
      toast.success(isActive ? `${p.code} activated` : `${p.code} paused`);
    } catch (err) {
      toast.error("Couldn't update", errorMessage(err));
    }
  };
  const remove = async (p: Promotion) => {
    if (!(await confirm({ title: `Delete ${p.code}?`, description: "Unused codes can be deleted. Codes used on orders can only be paused.", confirmLabel: "Delete", variant: "danger" }))) return;
    try {
      await adminApi(`/admin/promotions/${p.id}`, { method: "DELETE" });
      invalidate("/admin/promotions");
      toast.success("Code deleted");
    } catch (err) {
      toast.error("Couldn't delete", errorMessage(err));
    }
  };

  const columns: Column<Promotion>[] = [
    {
      id: "code",
      header: "Code",
      primary: true,
      cell: (p) => (
        <span className="min-w-0">
          <Mono className="font-medium text-ad-fg">{p.code}</Mono>
          <span className="block truncate text-xs text-ad-muted">{p.description || describe(p)}</span>
        </span>
      ),
    },
    { id: "state", header: "Status", mobile: true, width: "120px", cell: (p) => <Badge tone={STATE[promoState(p)].tone} dot>{STATE[promoState(p)].label}</Badge> },
    { id: "rule", header: "Discount", cell: (p) => <span className="text-ad-muted">{describe(p)}</span> },
    { id: "window", header: "Schedule", cell: (p) => <span className="whitespace-nowrap text-ad-muted">{p.startsAt || p.endsAt ? `${p.startsAt ? fmtDate(p.startsAt) : "Now"} → ${p.endsAt ? fmtDate(p.endsAt) : "No end"}` : "Always"}</span> },
    { id: "uses", header: "Uses", align: "end", mobile: true, width: "90px", cell: (p) => <span>{num(p.usedCount)}{p.usageLimit ? <span className="text-ad-faint"> / {p.usageLimit}</span> : null}</span> },
    { id: "revenue", header: "Sales", align: "end", width: "120px", cell: (p) => dzd(p.revenue) },
    { id: "given", header: "Discount given", align: "end", width: "130px", cell: (p) => <span className="text-ad-muted">{dzd(p.discountGiven)}</span> },
    {
      id: "on",
      header: "On",
      align: "end",
      width: "60px",
      cell: (p) => (
        <span data-no-row-click className="inline-flex">
          <Switch checked={p.isActive} onChange={(v) => void toggle(p, v)} id={`promo-on-${p.id}`} ariaLabel={`Active: ${p.code}`} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Discount codes customers enter at checkout. Limits and dates are enforced at checkout."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={15} /> New code
          </Button>
        }
      />
      <Card padded={false}>
        <div className="px-4 pt-1">
          <Tabs
            value={state.tab}
            onChange={(v) => set({ tab: v })}
            tabs={[
              { value: "", label: "All", count: q.data?.items.length },
              { value: "active", label: "Active", count: counts.active ?? 0 },
              { value: "scheduled", label: "Scheduled", count: counts.scheduled ?? 0 },
              { value: "paused", label: "Paused", count: counts.paused ?? 0 },
              { value: "expired", label: "Expired", count: (counts.expired ?? 0) + (counts.exhausted ?? 0) },
            ]}
          />
        </div>
        <Toolbar>
          <SearchBox value={state.q} onChange={(v) => set({ q: v })} placeholder="Search codes…" label="Search promotions" />
        </Toolbar>
        <DataTable
          label="Discount codes"
          rows={state.tab === "expired" ? (q.data?.items ?? []).filter((p) => ["expired", "exhausted"].includes(promoState(p))) : q.data ? items : undefined}
          rowId={(p) => p.id}
          columns={columns}
          loading={q.loading}
          error={q.error}
          onRetry={q.reload}
          onRowClick={(p) => set({ id: p.id })}
          rowActions={(p) => [
            { label: "Edit", icon: <Pencil size={14} />, onSelect: () => setEditing(p) },
            { label: "Copy code", icon: <Copy size={14} />, onSelect: () => void navigator.clipboard?.writeText(p.code).then(() => toast("Code copied")) },
            { type: "separator" },
            { label: "Delete", icon: <Trash2 size={14} />, danger: true, disabled: p.usedCount > 0, hint: p.usedCount > 0 ? "Used codes can only be paused" : undefined, onSelect: () => void remove(p) },
          ]}
          empty={<EmptyState icon={<TicketPercent size={18} />} title="No codes here" description="Create a code to run a campaign." action={<Button size="sm" variant="primary" onClick={() => setEditing("new")}>New code</Button>} />}
        />
      </Card>
      {editing && (
        <PromoDrawer
          key={editing === "new" ? "new" : editing.id}
          promo={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            if (state.new) set({ new: "" });
          }}
        />
      )}
      {viewing && !editing && <PromoDetails promo={viewing} onClose={() => set({ id: "" })} onEdit={() => setEditing(viewing)} />}
    </>
  );
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function PromoDrawer({ promo, onClose }: { promo: Promotion | null; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    code: promo?.code ?? "",
    description: promo?.description ?? "",
    type: (promo?.type ?? "percent") as "percent" | "fixed",
    value: promo ? String(promo.value) : "",
    minSubtotal: promo?.minSubtotal ? String(promo.minSubtotal) : "",
    maxDiscount: promo?.maxDiscount ? String(promo.maxDiscount) : "",
    startsAt: toLocalInput(promo?.startsAt ?? null),
    endsAt: toLocalInput(promo?.endsAt ?? null),
    usageLimit: promo?.usageLimit ? String(promo.usageLimit) : "",
    perUserLimit: promo?.perUserLimit ? String(promo.perUserLimit) : "",
    isActive: promo?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 9);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    const e: Record<string, string> = {};
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(f.code)) e.code = "2–40 letters, numbers, - or _";
    const v = Number(f.value);
    if (!v) e.value = "Enter a value";
    else if (f.type === "percent" && (v < 1 || v > 100)) e.value = "Between 1 and 100";
    if (f.startsAt && f.endsAt && f.endsAt <= f.startsAt) e.endsAt = "Must be after the start";
    setErrors(e);
    if (Object.keys(e).length) return;
    setPending(true);
    const body = {
      code: f.code,
      description: f.description.trim() || null,
      type: f.type,
      value: v,
      minSubtotal: Number(f.minSubtotal) || 0,
      maxDiscount: f.type === "percent" && f.maxDiscount ? Number(f.maxDiscount) : null,
      startsAt: f.startsAt ? new Date(`${f.startsAt}T00:00:00`).toISOString() : null,
      endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:59`).toISOString() : null,
      usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
      perUserLimit: f.perUserLimit ? Number(f.perUserLimit) : null,
      isActive: f.isActive,
    };
    try {
      await adminApi(promo ? `/admin/promotions/${promo.id}` : "/admin/promotions", { method: promo ? "PATCH" : "POST", body });
      invalidate("/admin/promotions");
      toast.success(promo ? "Code saved" : `${body.code.toUpperCase()} created`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error("Couldn't save", errorMessage(err));
    } finally {
      setPending(false);
    }
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={promo ? `Edit ${promo.code}` : "New discount code"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={pending} onClick={save}>
            {promo ? "Save" : "Create code"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Code" htmlFor="pr-code" error={errors.code} hint="Customers type this at checkout. Not case-sensitive.">
          <Input id="pr-code" value={f.code} invalid={Boolean(errors.code)} maxLength={40} className="font-[family-name:var(--font-admin-mono)] uppercase" onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} data-autofocus />
        </Field>
        <Field label="Internal description" optional htmlFor="pr-desc">
          <Textarea id="pr-desc" rows={2} value={f.description} maxLength={300} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Segmented ariaLabel="Discount type" size="md" value={f.type} onChange={(type) => set({ type })} options={[{ value: "percent", label: "Percentage" }, { value: "fixed", label: "Fixed amount" }]} />
          </Field>
          <Field label="Value" htmlFor="pr-value" error={errors.value}>
            <Input id="pr-value" inputMode="numeric" suffix={f.type === "percent" ? "%" : "DA"} value={f.value} invalid={Boolean(errors.value)} onChange={(e) => set({ value: digits(e.target.value) })} />
          </Field>
          <Field label="Minimum order" optional htmlFor="pr-min">
            <Input id="pr-min" inputMode="numeric" suffix="DA" value={f.minSubtotal} onChange={(e) => set({ minSubtotal: digits(e.target.value) })} />
          </Field>
          {f.type === "percent" && (
            <Field label="Maximum discount" optional htmlFor="pr-max">
              <Input id="pr-max" inputMode="numeric" suffix="DA" value={f.maxDiscount} onChange={(e) => set({ maxDiscount: digits(e.target.value) })} />
            </Field>
          )}
        </div>
        <div className="grid gap-3 border-t border-ad-border pt-4 sm:grid-cols-2">
          <Field label="Starts" optional htmlFor="pr-start">
            <DatePicker id="pr-start" value={f.startsAt} onChange={(v) => set({ startsAt: v })} placeholder="Immediately" />
          </Field>
          <Field label="Ends" optional htmlFor="pr-end" error={errors.endsAt}>
            <DatePicker id="pr-end" value={f.endsAt} invalid={Boolean(errors.endsAt)} onChange={(v) => set({ endsAt: v })} placeholder="No end date" min={f.startsAt || undefined} />
          </Field>
          <Field label="Total uses" optional htmlFor="pr-limit" hint="Across all customers">
            <Input id="pr-limit" inputMode="numeric" value={f.usageLimit} onChange={(e) => set({ usageLimit: digits(e.target.value) })} />
          </Field>
          <Field label="Uses per customer" optional htmlFor="pr-per" hint="Counted by account or phone">
            <Input id="pr-per" inputMode="numeric" value={f.perUserLimit} onChange={(e) => set({ perUserLimit: digits(e.target.value) })} />
          </Field>
        </div>
        <div className="border-t border-ad-border pt-4">
          <Switch checked={f.isActive} onChange={(isActive) => set({ isActive })} label="Active" description="Paused codes are refused at checkout." />
        </div>
        {f.value && (
          <p className="rounded-md bg-ad-subtle px-3 py-2 text-[13px] text-ad-muted">
            Preview: <span className="text-ad-fg">{describe({ type: f.type, value: Number(f.value), maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : null, minSubtotal: Number(f.minSubtotal) || 0 })}</span>
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

function PromoDetails({ promo, onClose, onEdit }: { promo: Promotion; onClose: () => void; onEdit: () => void }) {
  const q = useApi<{ promotion: PromotionDetail }>(`/admin/promotions/${promo.id}`);
  const d = q.data?.promotion;
  const st = promoState(promo);
  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={<Mono className="text-[15px]">{promo.code}</Mono>}
      description={describe(promo)}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={onEdit}>
            <Pencil size={14} /> Edit
          </Button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        <Badge tone={STATE[st].tone} dot>
          {STATE[st].label}
        </Badge>
        {promo.perUserLimit && <Badge>{promo.perUserLimit} per customer</Badge>}
      </div>
      <dl className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-ad-border bg-ad-border text-[13px]">
        {[
          ["Orders", num(promo.orderCount)],
          ["Sales", dzd(promo.revenue)],
          ["Discount given", dzd(promo.discountGiven)],
        ].map(([k, v]) => (
          <div key={k} className="bg-ad-panel p-3">
            <dt className="text-ad-muted">{k}</dt>
            <dd className="tnum mt-0.5 font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-2 text-sm font-semibold">Redemptions</h3>
      {!d ? (
        <p className="text-[13px] text-ad-muted">Loading…</p>
      ) : d.redemptions.length === 0 ? (
        <p className="text-[13px] text-ad-muted">Not used yet.</p>
      ) : (
        <ul className="divide-y divide-ad-border rounded-md border border-ad-border">
          {d.redemptions.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/orders/${r.orderNumber}`} className="flex items-center gap-3 px-3 py-2 text-[13px] hover:bg-ad-hover">
                <Mono className="w-24 shrink-0">{r.orderNumber}</Mono>
                <span className="min-w-0 flex-1 truncate">{r.customerName}</span>
                <Badge tone={ORDER_STATUS[r.orderStatus].tone}>{ORDER_STATUS[r.orderStatus].label}</Badge>
                <span className="tnum shrink-0 text-ad-muted">−{dzd(r.discount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-ad-faint">
        Created {fmtDateTime(promo.createdAt)} · updated {fmtDateTime(promo.updatedAt)}
      </p>
    </Drawer>
  );
}
