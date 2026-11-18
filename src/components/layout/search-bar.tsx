"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock, CornerDownLeft, Search, TrendingUp, X } from "lucide-react";
import { categories, products, variantPrice, type CategorySlug } from "@/lib/products";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { categoryIcons } from "@/components/icons";

const RECENT_KEY = "hanutek-rec…h-v1";

type Suggestion =
  | { kind: "product"; slug: string; href: string; label: string; sub: string; price: number; image: string }
  | { kind: "category"; slug: CategorySlug; href: string; label: string; sub: string };

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Case-insensitive match highlight. */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0 || !q.trim()) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-volt-soft px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const { m, t, price } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // close on outside pointer
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const s = q.trim().toLowerCase();

  const suggestions: Suggestion[] = useMemo(() => {
    if (!s) return [];
    const out: Suggestion[] = [];
    for (const c of categories) {
      const label = m.categories[c.slug].name;
      if (`${label} ${c.name}`.toLowerCase().includes(s)) {
        out.push({ kind: "category", slug: c.slug, href: `/products?category=${c.slug}`, label, sub: m.categories[c.slug].tagline });
      }
    }
    for (const p of products) {
      if (out.length >= 10) break;
      if (`${p.name} ${p.short}`.toLowerCase().includes(s)) {
        out.push({
          kind: "product",
          slug: p.slug,
          href: `/products/${p.slug}`,
          label: p.name,
          sub: m.categories[p.category].name,
          price: variantPrice(p, p.variants[0].id),
          image: p.image,
        });
      }
    }
    return out;
  }, [s, m]);

  const popular = useMemo(() => products.filter((p) => p.bestSeller).slice(0, 4), []);
  const list = s ? suggestions : [];
  const showSeeAll = s.length > 0 && list.length > 0;

  const remember = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((x) => x.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
      writeRecent(next);
      return next;
    });
  }, []);

  const go = useCallback(
    (href: string, query: string) => {
      remember(query);
      setOpen(false);
      inputRef.current?.blur();
      router.push(href, { transitionTypes: ["nav-forward"] });
    },
    [remember, router],
  );

  const submit = () => {
    if (!s) return;
    if (active >= 0 && list[active]) go(list[active].href, q);
    else go(`/products?q=${encodeURIComponent(q)}`, q);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, list.length + (showSeeAll ? 1 : 0) - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const expanded = open;

  return (
    <div ref={wrapRef} className="relative w-full">
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border bg-accent-soft/70 px-3.5 transition-colors duration-150 focus-within:ring-2 focus-within:ring-accent/25",
          expanded ? "border-foreground/30 bg-surface" : "border-line",
        )}
      >
        <Search size={16} className="shrink-0 text-faint" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls="hanutek-search-suggestions"
          aria-label={m.header.openSearch}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (recent.length === 0) setRecent(readRecent());
          }}
          onKeyDown={onKeyDown}
          placeholder={m.header.searchPlaceholder}
          className="search-input min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q ? (
          <button
            type="button"
            aria-label={m.common.clear}
            onClick={() => {
              setQ("");
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-faint transition-colors hover:bg-accent-soft hover:text-foreground"
          >
            <X size={13} />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint lg:block" aria-hidden>
            ↵
          </kbd>
        )}
      </div>

      <div
        id="hanutek-search-suggestions"
        role="dialog"
        aria-label={m.nav.search}
        hidden={!expanded}
        className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
      >
        {!s && (
          <div className="p-2.5">
            {recent.length > 0 && (
              <>
                <p className="flex items-center justify-between px-1.5 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint rtl:tracking-normal">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={11} /> {m.shell.searchRecent}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecent([]);
                      writeRecent([]);
                    }}
                    className="cursor-pointer text-muted normal-case tracking-normal underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {m.shell.searchClearRecent}
                  </button>
                </p>
                <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setQ(r);
                        setActive(-1);
                        inputRef.current?.focus();
                      }}
                      className="h-8 cursor-pointer rounded-full border border-line bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:border-foreground/25 hover:bg-accent-soft"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="flex items-center gap-1.5 px-1.5 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-faint rtl:tracking-normal">
              <TrendingUp size={11} /> {m.shell.searchPopular}
            </p>
            <div className="flex flex-wrap gap-1.5 px-1 pb-1">
              {popular.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => {
                    setQ(p.name);
                    setActive(-1);
                    inputRef.current?.focus();
                  }}
                  className="h-8 cursor-pointer rounded-full border border-line bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:border-foreground/25 hover:bg-accent-soft"
                >
                  <Highlight text={p.name} q="" />
                </button>
              ))}
            </div>
          </div>
        )}

        {s && list.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-muted">
              <Search size={20} />
            </span>
            <p className="text-sm text-muted">{t("shell.searchEmpty", { q })}</p>
            <Link
              href="/products"
              transitionTypes={["nav-forward"]}
              onClick={() => setOpen(false)}
              className="cursor-pointer text-sm font-semibold text-foreground underline underline-offset-4"
            >
              {m.shell.browseAll}
            </Link>
          </div>
        )}

        {s && list.length > 0 && (
          <ul role="listbox" aria-label={t("shell.searchResults", { n: list.length })} className="max-h-[55vh] space-y-0.5 overflow-y-auto p-2">
            {list.map((item, i) => {
              const isActive = active === i;
              const Icon = item.kind === "category" ? categoryIcons[item.slug] : null;
              return (
                <li key={`${item.kind}-${item.slug}`}>
                  <Link
                    href={item.href}
                    transitionTypes={["nav-forward"]}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      remember(q);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors duration-100",
                      isActive && "bg-accent-soft",
                    )}
                  >
                    {item.kind === "product" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line bg-background text-accent-ink">
                        {Icon && <Icon size={17} />}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span dir="ltr" className="block truncate text-[13px] font-medium leading-snug text-foreground rtl:text-right">
                        <Highlight text={item.label} q={q} />
                      </span>
                      <span className="block truncate text-[11px] text-muted">{item.sub}</span>
                    </span>
                    {item.kind === "product" && (
                      <span dir="ltr" className="num shrink-0 text-[13px] font-semibold text-foreground">
                        {price(item.price)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {showSeeAll && (
          <button
            type="button"
            onClick={() => go(`/products?q=${encodeURIComponent(q)}`, q)}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between gap-2 border-t border-line px-4 py-3 text-[13px] font-medium text-foreground transition-colors duration-100 hover:bg-accent-soft",
              active === list.length && "bg-accent-soft",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <ArrowRight size={14} className="shrink-0 text-muted rtl:-scale-x-100" />
              <span className="truncate">{t("shell.searchSeeAll", { q })}</span>
            </span>
            <CornerDownLeft size={12} className="shrink-0 text-faint" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
