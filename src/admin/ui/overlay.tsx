"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal, useDismiss, useFloating, useLayer } from "./floating";
import { Button, Input, useFieldId, type ButtonVariant } from "./core";

/* ------------------------------------------------------------------ Select */

export interface Option<V extends string = string> {
  value: V;
  label: ReactNode;
  /** plain text for type-ahead and the trigger when label is a node */
  text?: string;
  hint?: ReactNode;
  disabled?: boolean;
}

/**
 * Listbox select. Keyboard: Enter/Space/↓ opens, ↑/↓/Home/End move,
 * type-ahead jumps, Enter picks, Escape closes. Never a native <select>.
 */
export function Select<V extends string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ariaLabel,
  id,
  size = "md",
  className,
  invalid,
  disabled,
  prefix,
  align = "start",
}: {
  value: V | "" | null | undefined;
  onChange: (v: V) => void;
  options: Option<V>[];
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  size?: "sm" | "md";
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** text shown before the value in the trigger, e.g. "Status" */
  prefix?: string;
  align?: "start" | "end";
}) {
  const listId = useId();
  const fieldId = useFieldId(id);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const { layer, style } = useFloating(trigger, open, { matchWidth: true, align });
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [trigger, layer]);
  const typed = useRef({ s: "", t: 0 });
  const selected = options.findIndex((o) => o.value === value);
  const current = selected >= 0 ? options[selected] : null;

  const openAt = (i: number) => {
    setActive(Math.max(0, i));
    setOpen(true);
  };
  const pick = (o: Option<V>) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    trigger.current?.focus();
  };
  const move = (dir: 1 | -1, from = active) => {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) return setActive(i);
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openAt(selected >= 0 ? selected : 0);
      }
      return;
    }
    if (e.key === "ArrowDown") (e.preventDefault(), move(1));
    else if (e.key === "ArrowUp") (e.preventDefault(), move(-1));
    else if (e.key === "Home") (e.preventDefault(), setActive(0));
    else if (e.key === "End") (e.preventDefault(), setActive(options.length - 1));
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) pick(options[active]);
    } else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = { s: (now - typed.current.t < 600 ? typed.current.s : "") + e.key.toLowerCase(), t: now };
      const i = options.findIndex((o) => (o.text ?? String(o.label)).toLowerCase().startsWith(typed.current.s));
      if (i >= 0) setActive(i);
    }
  };

  useEffect(() => {
    if (open) layer.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, layer]);

  return (
    <>
      <button
        ref={trigger}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(selected >= 0 ? selected : 0))}
        onKeyDown={onKey}
        className={cn(
          "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-ad-border bg-ad-panel text-start text-[13px] text-ad-fg shadow-ad outline-none transition-[border-color,box-shadow] duration-100 hover:border-ad-border-strong focus-visible:border-ad-fg/40 focus-visible:ring-[3px] focus-visible:ring-[var(--ad-ring)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-ad-red",
          size === "sm" ? "h-8 px-2.5" : "h-9 px-2.5",
          open && "border-ad-border-strong",
          className,
        )}
      >
        <span className={cn("min-w-0 truncate", !current && "text-ad-faint")}>
          {prefix && <span className="text-ad-muted">{prefix}: </span>}
          {current ? (current.text ?? current.label) : placeholder}
        </span>
        <ChevronDown size={14} aria-hidden className={cn("shrink-0 text-ad-faint transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <Portal>
          <div
            ref={layer}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={style}
            onKeyDown={onKey}
            className="ad-anim-pop ad-scroll overflow-y-auto rounded-lg border border-ad-border bg-ad-panel p-1 shadow-ad-pop"
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                onPointerMove={() => !o.disabled && setActive(i)}
                onClick={() => pick(o)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
                  i === active && "bg-ad-hover",
                  o.disabled && "cursor-not-allowed opacity-45",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-ad-faint">{o.hint}</span>}
                <Check size={14} aria-hidden className={cn("shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
              </div>
            ))}
          </div>
        </Portal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Menu */

export type MenuItem =
  | { type?: "item"; label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; shortcut?: ReactNode; hint?: string }
  | { type: "separator" }
  | { type: "label"; label: ReactNode };

/** Dropdown menu with roving focus (↑/↓, Home/End, Enter, Escape). */
export function Menu({
  trigger,
  items,
  align = "end",
  label,
}: {
  trigger: (props: { ref: React.RefObject<HTMLButtonElement | null>; onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu"; onKeyDown: (e: React.KeyboardEvent) => void }) => ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const { layer, style } = useFloating(anchor, open, { align });
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [anchor, layer]);
  const actionable = items.map((it, i) => ((it.type ?? "item") === "item" && !(it as { disabled?: boolean }).disabled ? i : -1)).filter((i) => i >= 0);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (open) layer.current?.focus();
  }, [open, layer]);

  const run = (i: number) => {
    const it = items[i] as Extract<MenuItem, { onSelect: () => void }>;
    setOpen(false);
    anchor.current?.focus();
    it.onSelect();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const pos = actionable.indexOf(active);
    if (e.key === "ArrowDown") (e.preventDefault(), setActive(actionable[(pos + 1) % actionable.length]));
    else if (e.key === "ArrowUp") (e.preventDefault(), setActive(actionable[(pos - 1 + actionable.length) % actionable.length]));
    else if (e.key === "Home") (e.preventDefault(), setActive(actionable[0]));
    else if (e.key === "End") (e.preventDefault(), setActive(actionable[actionable.length - 1]));
    else if ((e.key === "Enter" || e.key === " ") && active >= 0) (e.preventDefault(), run(active));
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <>
      {trigger({
        ref: anchor,
        onClick: () => {
          setActive(-1);
          setOpen((o) => !o);
        },
        "aria-expanded": open,
        "aria-haspopup": "menu",
        onKeyDown: (e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setActive(actionable[0] ?? -1);
            setOpen(true);
          }
        },
      })}
      {open && (
        <Portal>
          <div
            ref={layer}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            style={style}
            onKeyDown={onKey}
            className="ad-anim-pop ad-scroll min-w-44 overflow-y-auto rounded-lg border border-ad-border bg-ad-panel p-1 shadow-ad-pop outline-none"
          >
            {items.map((it, i) => {
              if (it.type === "separator") return <div key={i} role="separator" className="-mx-1 my-1 h-px bg-ad-border" />;
              if (it.type === "label")
                return (
                  <div key={i} className="px-2 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-ad-faint">
                    {it.label}
                  </div>
                );
              return (
                <div
                  key={i}
                  role="menuitem"
                  aria-disabled={it.disabled || undefined}
                  title={it.hint}
                  onPointerMove={() => !it.disabled && setActive(i)}
                  onClick={() => !it.disabled && run(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
                    it.danger ? "text-ad-red" : "text-ad-fg",
                    active === i && (it.danger ? "bg-ad-red-soft" : "bg-ad-hover"),
                    it.disabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  {it.icon && <span className={cn("flex size-4 items-center justify-center", it.danger ? "text-ad-red" : "text-ad-muted")}>{it.icon}</span>}
                  <span className="flex-1 whitespace-nowrap">{it.label}</span>
                  {it.shortcut && <span className="ms-4 text-xs text-ad-faint">{it.shortcut}</span>}
                </div>
              );
            })}
          </div>
        </Portal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Popover */

export function Popover({
  trigger,
  children,
  align = "start",
  className,
  open: controlled,
  onOpenChange,
}: {
  trigger: (props: { ref: React.RefObject<HTMLButtonElement | null>; onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  className?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = useCallback((o: boolean) => (onOpenChange ? onOpenChange(o) : setInner(o)), [onOpenChange]);
  const anchor = useRef<HTMLButtonElement>(null);
  const { layer, style } = useFloating(anchor, open, { align });
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(open, close, [anchor, layer]);
  return (
    <>
      {trigger({ ref: anchor, onClick: () => setOpen(!open), "aria-expanded": open })}
      {open && (
        <Portal>
          <div ref={layer} role="dialog" style={style} className={cn("ad-anim-pop ad-scroll overflow-y-auto rounded-lg border border-ad-border bg-ad-panel shadow-ad-pop", className)}>
            {typeof children === "function" ? children(close) : children}
          </div>
        </Portal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Modal plumbing */

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = document.documentElement;
    const prev = el.style.overflow;
    const sbw = window.innerWidth - el.clientWidth;
    el.style.overflow = "hidden";
    if (sbw > 0) el.style.paddingRight = `${sbw}px`;
    return () => {
      el.style.overflow = prev;
      el.style.paddingRight = "";
    };
  }, [active]);
}

/** Focus trap + Escape (top-most layer only) + focus restore. */
function useModal(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  const isTop = useLayer(open);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const p = panel.current;
      if (!p || p.contains(document.activeElement)) return;
      (p.querySelector<HTMLElement>("[data-autofocus]") ?? p.querySelector<HTMLElement>("input,textarea,button:not([data-close]),[tabindex='0']") ?? p).focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab" && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      if (restore && document.contains(restore)) restore.focus();
    };
  }, [open, isTop, panel]);
}

/* ------------------------------------------------------------------ Dialog */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(open, onClose, panel);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="ad-anim-fade absolute inset-0 bg-[var(--ad-overlay)]" onClick={onClose} aria-hidden />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn(
            "ad-anim-dialog relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-ad-border bg-ad-panel shadow-ad-pop outline-none sm:rounded-xl",
            size === "sm" && "sm:max-w-sm",
            size === "md" && "sm:max-w-lg",
            size === "lg" && "sm:max-w-2xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[15px] font-semibold text-ad-fg">
                {title}
              </h2>
              {description && <p className="mt-1 text-[13px] text-ad-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" icon aria-label="Close" data-close onClick={onClose} className="-me-1.5 -mt-1">
              <X size={15} />
            </Button>
          </div>
          {children && <div className="ad-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>}
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-ad-border bg-ad-bg px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------------ Confirm */

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: ButtonVariant;
  /** user must type this text to enable the confirm button (destructive actions) */
  typeToConfirm?: string;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState("");
  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setState({ ...o, resolve });
      }),
    [],
  );
  const done = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const blocked = Boolean(state?.typeToConfirm && typed !== state.typeToConfirm);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => done(false)}
        size="sm"
        title={state?.title}
        description={state?.description}
        footer={
          <>
            <Button onClick={() => done(false)}>Cancel</Button>
            <Button variant={state?.variant ?? "primary"} disabled={blocked} onClick={() => done(true)} data-autofocus={!state?.typeToConfirm || undefined}>
              {state?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        {state?.typeToConfirm ? (
          <div className="pt-1">
            <p className="mb-2 text-[13px] text-ad-muted">
              Type <span className="font-medium text-ad-fg">{state.typeToConfirm}</span> to confirm.
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation text" data-autofocus autoComplete="off" />
          </div>
        ) : null}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/* ------------------------------------------------------------------ Drawer */

/** Right-side sheet on tablet/desktop, bottom sheet on phones. */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(open, onClose, panel);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[70]">
        <div className="ad-anim-fade absolute inset-0 bg-[var(--ad-overlay)]" onClick={onClose} aria-hidden />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          style={{ "--w": `${width}px` } as React.CSSProperties}
          className="ad-anim-drawer absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-xl border border-ad-border bg-ad-panel shadow-ad-pop outline-none sm:inset-y-0 sm:start-auto sm:end-0 sm:max-h-none sm:w-[min(var(--w),100vw)] sm:rounded-none sm:border-y-0 sm:border-e-0"
        >
          <div className="flex items-start justify-between gap-4 border-b border-ad-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-[15px] font-semibold text-ad-fg">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-[13px] text-ad-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" icon aria-label="Close" data-close onClick={onClose} className="-me-1.5">
              <X size={15} />
            </Button>
          </div>
          <div className="ad-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-ad-border bg-ad-bg px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------------ Toasts */

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}
interface ToastApi {
  (title: ReactNode, opts?: { description?: ReactNode; tone?: ToastTone; action?: ToastItem["action"]; duration?: number }): void;
  success: (title: ReactNode, description?: ReactNode) => void;
  error: (title: ReactNode, description?: ReactNode) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);
export function useToast() {
  const t = useContext(ToastCtx);
  if (!t) throw new Error("useToast outside ToastProvider");
  return t;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const api = useMemo(() => {
    const push = ((title, opts = {}) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, title, description: opts.description, tone: opts.tone ?? "info", action: opts.action }]);
      setTimeout(() => dismiss(id), opts.duration ?? (opts.tone === "error" ? 7000 : 4000));
    }) as ToastApi;
    push.success = (title, description) => push(title, { description, tone: "success" });
    push.error = (title, description) => push(title, { description, tone: "error" });
    return push;
  }, [dismiss]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-[90] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:end-4 sm:bottom-4 sm:w-[360px]">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="ad-anim-dialog pointer-events-auto flex items-start gap-3 rounded-lg border border-ad-border bg-ad-panel px-3.5 py-3 shadow-ad-pop"
          >
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                t.tone === "success" && "bg-ad-green",
                t.tone === "error" && "bg-ad-red",
                t.tone === "info" && "bg-ad-faint",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ad-fg">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[12.5px] text-ad-muted">{t.description}</p>}
            </div>
            {t.action && (
              <Button
                size="xs"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </Button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-me-1 mt-0.5 cursor-pointer rounded p-0.5 text-ad-faint hover:text-ad-fg">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ Tabs & segmented */

export function Tabs<V extends string>({ value, onChange, tabs, className }: { value: V; onChange: (v: V) => void; tabs: { value: V; label: ReactNode; count?: number }[]; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" className={cn("ad-scroll -mb-px flex gap-1 overflow-x-auto border-b border-ad-border", className)}>
      {tabs.map((t, i) => (
        <button
          key={t.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          aria-selected={t.value === value}
          tabIndex={t.value === value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const n = (i + d + tabs.length) % tabs.length;
            onChange(tabs[n].value);
            refs.current[n]?.focus();
          }}
          className={cn(
            "relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] transition-colors",
            t.value === value ? "font-medium text-ad-fg" : "text-ad-muted hover:text-ad-fg",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="tnum rounded-full bg-ad-subtle px-1.5 text-[11px] text-ad-muted">{t.count}</span>}
          {t.value === value && <span aria-hidden className="absolute inset-x-1.5 -bottom-px h-[1.5px] rounded-full bg-ad-fg" />}
        </button>
      ))}
    </div>
  );
}

export function Segmented<V extends string>({ value, onChange, options, ariaLabel, size = "sm" }: { value: V; onChange: (v: V) => void; options: { value: V; label: ReactNode }[]; ariaLabel: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-md border border-ad-border bg-ad-subtle p-0.5", size === "sm" ? "h-8" : "h-9")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "cursor-pointer rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors",
            o.value === value ? "bg-ad-panel text-ad-fg shadow-ad" : "text-ad-muted hover:text-ad-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
