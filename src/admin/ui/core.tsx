"use client";

import { createContext, forwardRef, useContext, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Minus, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "../lib/meta";
import { initials } from "../lib/format";

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "xs" | "sm" | "md";

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium",
    "transition-[background-color,border-color,color,box-shadow,opacity] duration-100",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    size === "xs" && "h-7 px-2 text-xs",
    size === "sm" && "h-8 px-2.5 text-[13px]",
    size === "md" && "h-9 px-3.5 text-[13px]",
    variant === "primary" && "bg-ad-ink text-ad-ink-fg hover:opacity-90",
    variant === "secondary" && "border border-ad-border bg-ad-panel text-ad-fg shadow-ad hover:bg-ad-hover",
    variant === "ghost" && "text-ad-muted hover:bg-ad-hover hover:text-ad-fg",
    variant === "danger" && "bg-ad-red text-white hover:opacity-90",
    variant === "danger-ghost" && "text-ad-red hover:bg-ad-red-soft",
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** square icon-only button; pass an aria-label */
  icon?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, cn(icon && (size === "xs" ? "w-7 px-0" : size === "sm" ? "w-8 px-0" : "w-9 px-0"), className))}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

export function LinkButton({ href, variant = "secondary", size = "md", className, children, ...rest }: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode; "aria-label"?: string }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-80", className)} />;
}

/* ------------------------------------------------------------------ Fields */

const control =
  "w-full rounded-md border border-ad-border bg-ad-panel text-[13px] text-ad-fg shadow-ad outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-ad-faint hover:border-ad-border-strong focus:border-ad-fg/40 focus:ring-[3px] focus:ring-[var(--ad-ring)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-ad-red aria-[invalid=true]:focus:ring-ad-red/20";

export function Label({ htmlFor, children, optional, className }: { htmlFor?: string; children: ReactNode; optional?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ad-fg", className)}>
      {children}
      {optional && <span className="font-normal text-ad-faint">Optional</span>}
    </label>
  );
}

/** Lets Input/Textarea/Select/DatePicker pick up the id their Field label points to. */
export const FieldContext = createContext<{ id: string; describedBy?: string } | null>(null);
export function useFieldId(own?: string) {
  const field = useContext(FieldContext);
  return own ?? field?.id;
}

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  htmlFor,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const msgId = `${id}-msg`;
  return (
    <FieldContext.Provider value={{ id, describedBy: error || hint ? msgId : undefined }}>
    <div className={cn("min-w-0", className)}>
      {label && (
        <Label htmlFor={id} optional={optional}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p id={msgId} role="alert" className="mt-1.5 text-xs text-ad-red">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="mt-1.5 text-xs text-ad-faint">{hint}</p>
      ) : null}
    </div>
    </FieldContext.Provider>
  );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputSize?: "sm" | "md";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, prefix, suffix, className, inputSize = "md", id: ownId, ...rest }, ref) {
  const field = useContext(FieldContext);
  const props = { id: ownId ?? field?.id, "aria-describedby": rest["aria-describedby"] ?? field?.describedBy, ...rest };
  const h = inputSize === "sm" ? "h-8" : "h-9";
  if (!prefix && !suffix) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, h, "px-2.5", className)} {...props} />;
  }
  return (
    <div className={cn("relative flex items-center", className)}>
      {prefix && <span className="pointer-events-none absolute start-2.5 flex items-center text-ad-faint">{prefix}</span>}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, h, prefix ? "ps-8" : "ps-2.5", suffix ? "pe-10" : "pe-2.5")}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute end-2.5 text-xs text-ad-faint">{suffix}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { invalid, className, rows = 3, id: ownId, ...rest },
  ref,
) {
  const field = useContext(FieldContext);
  const props = { id: ownId ?? field?.id, "aria-describedby": rest["aria-describedby"] ?? field?.describedBy, ...rest };
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(control, "resize-y px-2.5 py-2 leading-relaxed", className)} {...props} />;
});

/* ------------------------------------------------------------------ Checkbox & switch */

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  disabled,
  className,
  "aria-label": ariaLabel,
  id,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean, e: React.MouseEvent | React.KeyboardEvent) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  id?: string;
}) {
  const box = (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked, e);
      }}
      className={cn(
        "grid size-4 shrink-0 cursor-pointer place-items-center rounded-[4px] border transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50",
        checked || indeterminate ? "border-ad-ink bg-ad-ink text-ad-ink-fg" : "border-ad-border-strong bg-ad-panel hover:border-ad-faint",
        !label && className,
      )}
    >
      {indeterminate ? <Minus size={11} strokeWidth={3} /> : checked ? <Check size={11} strokeWidth={3} /> : null}
    </button>
  );
  if (!label) return box;
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-[13px] text-ad-fg", disabled && "cursor-not-allowed opacity-60", className)}>
      {box}
      <span>{label}</span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id: idProp,
  ariaLabel,
}: {
  ariaLabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const sw = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-ad-ink" : "bg-ad-border-strong",
      )}
    >
      <span className={cn("absolute size-4 rounded-full bg-ad-panel shadow-sm transition-transform duration-150", checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5")} />
    </button>
  );
  if (!label) return sw;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[13px] font-medium text-ad-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ad-muted">{description}</span>}
      </label>
      {sw}
    </div>
  );
}

/* ------------------------------------------------------------------ Badges */

const toneClass: Record<Tone, string> = {
  neutral: "bg-ad-subtle text-ad-muted",
  green: "bg-ad-green-soft text-ad-green",
  amber: "bg-ad-amber-soft text-ad-amber",
  red: "bg-ad-red-soft text-ad-red",
  blue: "bg-ad-blue-soft text-ad-blue",
  violet: "bg-ad-violet-soft text-ad-violet",
};
const dotClass: Record<Tone, string> = {
  neutral: "bg-ad-faint",
  green: "bg-ad-green",
  amber: "bg-ad-amber",
  red: "bg-ad-red",
  blue: "bg-ad-blue",
  violet: "bg-ad-violet",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium", toneClass[tone], className)}>
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", dotClass[tone])} />}
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", dotClass[tone])} />;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border border-ad-border bg-ad-subtle px-1 font-[family-name:var(--font-admin-mono)] text-[10.5px] font-medium text-ad-muted", className)}>
      {children}
    </kbd>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-[family-name:var(--font-admin-mono)] text-[12.5px]", className)}>{children}</span>;
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="grid shrink-0 place-items-center rounded-full border border-ad-border bg-ad-subtle font-medium text-ad-muted"
    >
      {initials(name)}
    </span>
  );
}

export function Thumb({ src, alt = "", size = 32 }: { src?: string | null; alt?: string; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="relative block shrink-0 overflow-hidden rounded-md border border-ad-border bg-ad-subtle">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnails: tiny, already optimized WebP renditions
        <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ Layout blocks */

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  // min-w-0: cards are often grid/flex items; never let long content widen them past the viewport
  return <section className={cn("min-w-0 rounded-lg border border-ad-border bg-ad-panel shadow-ad", padded && "p-4 sm:p-5", className)}>{children}</section>;
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ad-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ad-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] text-ad-muted transition-colors hover:text-ad-fg">
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="truncate text-xl font-semibold tracking-[-0.015em] text-ad-fg sm:text-[22px]">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1 text-[13px] text-ad-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("ad-skeleton block h-4", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-3 grid size-10 place-items-center rounded-lg border border-ad-border bg-ad-subtle text-ad-muted">{icon}</div>}
      <p className="text-sm font-medium text-ad-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ad-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const msg = (error as { message?: string })?.message ?? "Something went wrong";
  const forbidden = (error as { code?: string })?.code === "FORBIDDEN";
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 grid size-10 place-items-center rounded-lg border border-ad-border bg-ad-red-soft text-ad-red">
        <AlertTriangle size={18} />
      </div>
      <p className="text-sm font-medium text-ad-fg">{forbidden ? "You don't have access to this" : "Couldn't load this"}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ad-muted">{forbidden ? "Ask an admin for the required permission." : msg}</p>
      {onRetry && !forbidden && (
        <Button size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw size={13} /> Try again
        </Button>
      )}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-ad-border", className)} />;
}

/** Definition list used on detail pages. */
export function Details({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(96px,auto)_1fr] gap-x-4 gap-y-2.5 text-[13px]", className)}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-ad-muted">{it.label}</dt>
          <dd className="min-w-0 break-words text-ad-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Auto-focus the first invalid field after a failed submit. */
export function useFocusFirstError(errors: Record<string, string | undefined> | null) {
  const container = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!errors || !Object.values(errors).some(Boolean)) return;
    container.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  return container;
}
