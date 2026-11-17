"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Custom dropdown — full styling control, zero browser-default chrome.
 * Keyboard: Enter/Space open, arrows navigate, Enter select, Esc close.
 */
export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
  align = "end",
  triggerPrefix,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  align?: "start" | "end";
  /** Optional prefix shown in the trigger before the selected label (e.g. "Trier par:"). */
  triggerPrefix?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIdx];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={ariaLabel}
        onClick={() => {
          setActiveIdx(selectedIdx);
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            if (!open) {
              e.preventDefault();
              setOpen(true);
            }
          }
        }}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-foreground transition-colors duration-150 hover:border-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
          open && "border-foreground/30",
          buttonClassName,
        )}
      >
        <span className="truncate">{triggerPrefix ? `${triggerPrefix} ${current?.label}` : current?.label}</span>
        <ChevronDown size={14} className={cn("shrink-0 text-muted transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % options.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + options.length) % options.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(options[activeIdx].value);
            }
          }}
          ref={(el) => el?.focus()}
          className={cn(
            "absolute top-[calc(100%+6px)] z-50 max-h-72 min-w-full overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop outline-none",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {options.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-[13px] transition-colors duration-100",
                  i === activeIdx ? "bg-accent-soft" : "",
                  o.value === value ? "font-semibold text-foreground" : "text-muted",
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check size={14} className="shrink-0 text-accent-ink" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
