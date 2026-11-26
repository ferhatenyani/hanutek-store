"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { Eye, EyeOff, Minus, Plus } from "lucide-react";
import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "volt" | "dark" | "outline" | "ghost" | "soft";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-control font-semibold",
    "transition-[background-color,border-color,color,transform,box-shadow,filter] duration-150 ease-out-quint",
    "disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97]",
    size === "sm" && "h-9 px-4 text-[13px]",
    size === "md" && "h-11 px-5 text-sm",
    size === "lg" && "h-12 px-6 text-[15px]",
    variant === "primary" && "bg-accent text-white shadow-card hover:bg-accent-ink",
    variant === "volt" && "bg-volt text-foreground shadow-card hover:brightness-[1.04]",
    variant === "dark" && "bg-foreground text-background hover:bg-foreground/85",
    variant === "outline" && "border border-line bg-surface text-foreground hover:border-faint hover:bg-background",
    variant === "ghost" && "text-foreground hover:bg-accent-soft",
    variant === "soft" && "bg-accent-soft text-foreground hover:bg-accent-soft/70",
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

/* ---------- Form fields ---------- */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Classes for the wrapper (grid placement such as `sm:col-span-2`); `className` styles the input. */
  containerClassName?: string;
}

export function Input({ label, error, hint, className, containerClassName, id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? (props.name ? `${props.name}-${autoId}` : autoId);
  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-11 w-full rounded-control border border-line bg-surface px-3.5 text-sm text-foreground transition-colors",
          "placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
          error && "border-danger focus:border-danger focus:ring-danger/15",
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-msg` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-msg`} className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-msg`} className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Password input with a show/hide toggle. The label is a real <label for>,
 * and `aside` (e.g. a "forgot password?" link) sits next to it — never inside
 * it, so the field's accessible name stays just the label.
 */
export function PasswordField({
  label,
  aside,
  showLabel,
  hideLabel,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; aside?: ReactNode; showLabel: string; hideLabel: string }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    // grid: the aside sits beside the label visually but after the input in the
    // DOM, so Tab goes e-mail → password → "forgot password?".
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
      <label htmlFor={id} className="col-start-1 row-start-1 text-[13px] font-medium text-foreground">
        {label}
      </label>
      <div className="relative col-span-2 row-start-2">
        <input
          id={id}
          type={show ? "text" : "password"}
          dir="ltr"
          className={cn(
            "h-11 w-full rounded-control border border-line bg-surface ps-3.5 pe-12 text-sm text-foreground transition-colors",
            "placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? hideLabel : showLabel}
          aria-pressed={show}
          className="absolute end-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-control text-faint transition-colors hover:text-foreground"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {aside && <div className="col-start-2 row-start-1 justify-self-end">{aside}</div>}
    </div>
  );
}

/* ---------- Badge ---------- */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "volt" | "success" | "dark" | "danger" | "sale";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] rtl:tracking-normal",
        tone === "neutral" && "bg-accent-soft text-muted",
        tone === "accent" && "bg-accent-soft text-foreground",
        tone === "volt" && "bg-volt text-foreground",
        tone === "success" && "bg-success-soft text-success",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "sale" && "bg-sale text-white",
        tone === "dark" && "bg-foreground text-volt",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Quantity stepper ---------- */

export function QtyStepper({
  qty,
  onChange,
  size = "md",
  max = 10,
}: {
  qty: number;
  onChange: (qty: number) => void;
  size?: "sm" | "md";
  max?: number;
}) {
  const { locale } = useI18n();
  const dec = locale === "ar" ? "إنقاص الكمية" : "Diminuer la quantité";
  const inc = locale === "ar" ? "زيادة الكمية" : "Augmenter la quantité";
  const btn = cn(
    "flex cursor-pointer items-center justify-center text-muted transition-colors duration-150 hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
    size === "sm" ? "h-8 w-8" : "h-10 w-10",
  );
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-control border border-line bg-surface",
        size === "sm" ? "h-8" : "h-10",
      )}
    >
      <button type="button" aria-label={dec} className={btn} disabled={qty <= 1} onClick={() => onChange(qty - 1)}>
        <Minus size={size === "sm" ? 13 : 15} />
      </button>
      <span className={cn("num min-w-7 text-center font-semibold", size === "sm" ? "text-xs" : "text-sm")}>{qty}</span>
      <button type="button" aria-label={inc} className={btn} disabled={qty >= max} onClick={() => onChange(qty + 1)}>
        <Plus size={size === "sm" ? 13 : 15} />
      </button>
    </div>
  );
}

/* ---------- Section heading ---------- */

export function SectionHead({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted rtl:tracking-normal">{eyebrow}</p>
        )}
        <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ---------- Spinner ---------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      aria-hidden
    />
  );
}
