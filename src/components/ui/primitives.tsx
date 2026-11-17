import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "volt" | "dark" | "outline" | "ghost" | "soft";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 select-none",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    size === "sm" && "h-9 px-4 text-[13px]",
    size === "md" && "h-11 px-6 text-sm",
    size === "lg" && "h-12 px-7 text-[15px]",
    variant === "primary" && "bg-accent text-white shadow-[0_1px_2px_rgba(17,40,112,0.3)] hover:bg-accent-ink",
    variant === "volt" && "bg-volt text-accent shadow-[0_1px_2px_rgba(17,40,112,0.15)] hover:bg-[#c8e01e]",
    variant === "dark" && "bg-foreground text-background hover:bg-foreground/85",
    variant === "outline" && "border border-line bg-background text-foreground hover:border-foreground/30 hover:bg-surface",
    variant === "ghost" && "text-foreground hover:bg-surface",
    variant === "soft" && "bg-accent-soft text-accent-ink hover:bg-accent-soft/70",
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

/* ---------- Form fields ---------- */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-11 w-full rounded-xl border border-[#c9cdd6] bg-background px-3.5 text-sm text-foreground transition-colors",
          "placeholder:text-faint hover:border-foreground/25 focus:border-accent focus:outline-none",
          error && "border-danger focus:border-danger",
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, id, children, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "h-11 w-full cursor-pointer appearance-none rounded-xl border border-line bg-background px-3.5 text-sm text-foreground",
          "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2361656c%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_14px_center] bg-no-repeat pr-9",
          "transition-colors hover:border-foreground/25 focus:border-accent focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </select>
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
  tone?: "neutral" | "accent" | "volt" | "success" | "dark" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide",
        tone === "neutral" && "bg-surface text-muted",
        tone === "accent" && "bg-accent-soft text-accent-ink",
        tone === "volt" && "bg-volt text-accent",
        tone === "success" && "bg-success/10 text-success",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "dark" && "bg-foreground text-background",
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
  const btn = cn(
    "flex cursor-pointer items-center justify-center text-muted transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none",
    size === "sm" ? "h-8 w-8" : "h-10 w-10",
  );
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-background",
        size === "sm" ? "h-8" : "h-10",
      )}
    >
      <button type="button" aria-label="Decrease quantity" className={btn} disabled={qty <= 1} onClick={() => onChange(qty - 1)}>
        <Minus size={size === "sm" ? 13 : 15} />
      </button>
      <span className={cn("min-w-7 text-center font-mono tabular-nums", size === "sm" ? "text-xs" : "text-sm")}>{qty}</span>
      <button type="button" aria-label="Increase quantity" className={btn} disabled={qty >= max} onClick={() => onChange(qty + 1)}>
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
          <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-semibold tracking-tight text-balance md:text-[28px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ---------- Spinner ---------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}