"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "./overlay";
import { useFieldId } from "./core";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const labelFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const DOW = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

/** Calendar date picker (value "YYYY-MM-DD" or ""). Keyboard: arrows move, Enter picks, PageUp/Down change month. */
export function DatePicker({ value, onChange, id, placeholder = "Choisir une date", invalid, min }: { value: string; onChange: (v: string) => void; id?: string; placeholder?: string; invalid?: boolean; min?: string }) {
  const fieldId = useFieldId(id);
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value) : null;
  const [cursor, setCursor] = useState<Date>(selected ?? new Date());
  const view = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (view.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i - offset + 1));
  const today = ymd(new Date());
  const disabled = (d: Date) => Boolean(min && ymd(d) < min);
  const pick = (d: Date) => {
    if (disabled(d)) return;
    onChange(ymd(d));
    setOpen(false);
  };
  const shift = (days: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth(), c.getDate() + days));
  const shiftMonth = (m: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + m, Math.min(c.getDate(), 28)));

  return (
    <div className="relative">
      <Popover
        open={open}
        onOpenChange={(o) => {
          if (o) setCursor(selected ?? new Date());
          setOpen(o);
        }}
        className="w-[268px] p-3"
        trigger={(p) => (
          <button
            {...p}
            id={fieldId}
            type="button"
            aria-haspopup="dialog"
            aria-invalid={invalid || undefined}
            className={cn(
              "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-ad-border bg-ad-panel px-2.5 text-start text-[13px] shadow-ad outline-none transition-[border-color,box-shadow] hover:border-ad-border-strong focus-visible:border-ad-fg/40 focus-visible:ring-[3px] focus-visible:ring-[var(--ad-ring)] aria-[invalid=true]:border-ad-red",
              !selected && "text-ad-faint",
            )}
          >
            <CalendarDays size={14} className="shrink-0 text-ad-faint" aria-hidden />
            <span className="flex-1 truncate">{selected ? labelFmt.format(selected) : placeholder}</span>
          </button>
        )}
      >
        <div
          onKeyDown={(e) => {
            const map: Record<string, () => void> = {
              ArrowLeft: () => shift(-1),
              ArrowRight: () => shift(1),
              ArrowUp: () => shift(-7),
              ArrowDown: () => shift(7),
              PageUp: () => shiftMonth(-1),
              PageDown: () => shiftMonth(1),
              Enter: () => pick(cursor),
            };
            if (map[e.key]) {
              e.preventDefault();
              map[e.key]();
            }
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Mois précédent" onClick={() => shiftMonth(-1)} className="grid size-7 cursor-pointer place-items-center rounded-md text-ad-muted hover:bg-ad-hover hover:text-ad-fg">
              <ChevronLeft size={15} />
            </button>
            <span className="text-[13px] font-medium" aria-live="polite">
              {monthFmt.format(view)}
            </span>
            <button type="button" aria-label="Mois suivant" onClick={() => shiftMonth(1)} className="grid size-7 cursor-pointer place-items-center rounded-md text-ad-muted hover:bg-ad-hover hover:text-ad-fg">
              <ChevronRight size={15} />
            </button>
          </div>
          <div role="grid" aria-label={monthFmt.format(view)} className="grid grid-cols-7 gap-0.5 text-center text-[12px]">
            {DOW.map((d) => (
              <span key={d} role="columnheader" className="py-1 text-[11px] text-ad-faint">
                {d}
              </span>
            ))}
            {days.map((d) => {
              const k = ymd(d);
              const inMonth = d.getMonth() === view.getMonth();
              const isSel = value === k;
              const isCursor = ymd(cursor) === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-label={labelFmt.format(d)}
                  tabIndex={isCursor ? 0 : -1}
                  ref={(el) => {
                    if (isCursor && open && el && el.ownerDocument.activeElement?.closest("[role=grid]")) el.focus();
                  }}
                  disabled={disabled(d)}
                  onClick={() => pick(d)}
                  className={cn(
                    "grid h-8 cursor-pointer place-items-center rounded-md tnum transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                    !inMonth && "text-ad-faint",
                    isSel ? "bg-ad-ink font-medium text-ad-ink-fg" : "hover:bg-ad-hover",
                    !isSel && k === today && "font-semibold underline underline-offset-4",
                    !isSel && isCursor && "ring-1 ring-ad-border-strong",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-ad-border pt-2">
            <button type="button" onClick={() => pick(new Date())} className="cursor-pointer rounded px-1.5 py-1 text-[12.5px] text-ad-muted hover:bg-ad-hover hover:text-ad-fg">
              Aujourd’hui
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[12.5px] text-ad-muted hover:bg-ad-hover hover:text-ad-fg"
              >
                <X size={12} /> Effacer
              </button>
            )}
          </div>
        </div>
      </Popover>
    </div>
  );
}
