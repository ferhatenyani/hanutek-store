"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bookmark, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Kbd } from "../ui/core";
import { Dialog, Popover, Select, useToast, type Option } from "../ui/overlay";
import { useSavedViews } from "./state";

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 border-b border-ad-border px-4 py-3", className)}>{children}</div>;
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA"].includes(el.tagName) || el.getAttribute("role") === "combobox");

/** Debounced search box. "/" focuses it from anywhere on the page. */
export function SearchBox({ value, onChange, placeholder = "Rechercher…", className, label = "Rechercher" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const lastSent = useRef(value);
  // external changes (reset, saved view) win over the local draft
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync controlled draft with URL
      setText(value);
    }
  }, [value]);
  useEffect(() => {
    if (text === lastSent.current) return;
    const t = setTimeout(() => {
      lastSent.current = text;
      onChange(text);
    }, 250);
    return () => clearTimeout(t);
  }, [text, onChange]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTyping(e.target) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-xs", className)}>
      <Search size={14} aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ad-faint" />
      <Input
        ref={ref}
        type="search"
        inputSize="sm"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && text) {
            e.stopPropagation();
            setText("");
          }
          if (e.key === "Enter") {
            lastSent.current = text;
            onChange(text);
          }
        }}
        className="ps-8 pe-14 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center">
        {text ? (
          <button type="button" aria-label="Effacer la recherche" onClick={() => setText("")} className="cursor-pointer rounded p-0.5 text-ad-faint hover:text-ad-fg">
            <X size={13} />
          </button>
        ) : (
          <Kbd className="hidden sm:inline-flex">/</Kbd>
        )}
      </span>
    </div>
  );
}

/** Compact filter select with an "All" option. */
export function FilterSelect<V extends string>({ label, value, onChange, options, allLabel = "Tous", width = "w-[150px]" }: { label: string; value: V | ""; onChange: (v: V | "") => void; options: Option<V>[]; allLabel?: string; width?: string }) {
  const all: Option<V | "">[] = [{ value: "" as V | "", label: allLabel, text: allLabel }, ...options];
  return (
    <div className={width}>
      <Select<V | "">
        size="sm"
        ariaLabel={label}
        prefix={label}
        value={value}
        onChange={(v) => onChange(v)}
        options={all as Option<V | "">[]}
        className={value ? "border-ad-border-strong" : undefined}
      />
    </div>
  );
}

export function ResetFilters({ count, onReset }: { count: number; onReset: () => void }) {
  if (!count) return null;
  return (
    <Button size="sm" variant="ghost" onClick={onReset}>
      <X size={13} /> Réinitialiser{count > 1 ? ` (${count})` : ""}
    </Button>
  );
}

/** Saved filter presets (per table, stored on this device). */
export function SavedViews({ tableId, current, onApply }: { tableId: string; current: string; onApply: (query: string) => void }) {
  const { views, save, remove } = useSavedViews(tableId);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const toast = useToast();
  const activeView = views.find((v) => v.query === current);
  return (
    <>
      <Popover
        align="end"
        className="w-64 p-1"
        trigger={(p) => (
          <Button {...p} size="sm" aria-label="Vues enregistrées">
            <Bookmark size={14} className={activeView ? "fill-current" : undefined} />
            <span className="hidden max-w-28 truncate lg:inline">{activeView ? activeView.name : "Views"}</span>
          </Button>
        )}
      >
        {(close) => (
          <div>
            <p className="px-2 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-ad-faint">Vues enregistrées</p>
            {views.length === 0 && <p className="px-2 py-2 text-[13px] text-ad-muted">Enregistrez les filtres actuels pour les retrouver en un clic.</p>}
            {views.map((v) => (
              <div key={v.id} className="group flex items-center rounded-md hover:bg-ad-hover">
                <button
                  type="button"
                  onClick={() => {
                    onApply(v.query);
                    close();
                  }}
                  className={cn("min-w-0 flex-1 cursor-pointer truncate px-2 py-1.5 text-start text-[13px]", v.query === current ? "font-medium text-ad-fg" : "text-ad-fg")}
                >
                  {v.name}
                </button>
                <button type="button" aria-label={`Supprimer la vue ${v.name}`} onClick={() => remove(v.id)} className="me-1 cursor-pointer rounded p-1 text-ad-faint opacity-0 hover:text-ad-red group-hover:opacity-100 focus-visible:opacity-100">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="-mx-1 my-1 h-px bg-ad-border" />
            <button
              type="button"
              disabled={!current}
              onClick={() => {
                close();
                setName("");
                setNaming(true);
              }}
              className="w-full cursor-pointer rounded-md px-2 py-1.5 text-start text-[13px] text-ad-fg hover:bg-ad-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enregistrer les filtres actuels…
            </button>
          </div>
        )}
      </Popover>
      <Dialog
        open={naming}
        onClose={() => setNaming(false)}
        size="sm"
        title="Enregistrer la vue"
        description="Mémorise les filtres, la recherche et le tri actuels sur cet appareil."
        footer={
          <>
            <Button onClick={() => setNaming(false)}>Annuler</Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                save(name.trim(), current);
                setNaming(false);
                toast.success(`Vue « ${name.trim()} » enregistrée`);
              }}
            >
              Enregistrer la vue
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            save(name.trim(), current);
            setNaming(false);
            toast.success(`Vue « ${name.trim()} » enregistrée`);
          }}
        >
          <Input aria-label="Nom de la vue" placeholder="ex. À expédier aujourd’hui" value={name} onChange={(e) => setName(e.target.value)} data-autofocus maxLength={40} />
        </form>
      </Dialog>
    </>
  );
}
