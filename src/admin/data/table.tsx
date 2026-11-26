"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Checkbox, EmptyState, ErrorState, Skeleton } from "../ui/core";
import { Menu, Popover, Select, type MenuItem } from "../ui/overlay";
import { useStoredState } from "./state";
import { errorMessage } from "../lib/client";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** server sort key; makes the header clickable */
  sortKey?: string;
  align?: "start" | "end";
  /** CSS width (e.g. "120px") */
  width?: string;
  /** shown as the title line of the mobile card */
  primary?: boolean;
  /** shown in the mobile card meta line */
  mobile?: boolean;
  /** can be hidden from the Columns menu (default: true, except primary) */
  hideable?: boolean;
  defaultHidden?: boolean;
  className?: string;
}

export interface Sort {
  key: string;
  dir: "asc" | "desc";
}

/** Visible-column preferences per table, remembered on this device. */
export function useColumns<T>(tableId: string, columns: Column<T>[]) {
  const defaults = useMemo(() => columns.filter((c) => c.defaultHidden).map((c) => c.id), [columns]);
  const [hidden, setHidden] = useStoredState<string[]>(`adm:cols:${tableId}`, defaults);
  const visible = columns.filter((c) => !hidden.includes(c.id));
  const toggle = (id: string) => setHidden(hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]);
  const menu = (
    <Popover
      align="end"
      className="w-56 p-1"
      trigger={(p) => (
        <Button {...p} size="sm" aria-label="Choisir les colonnes">
          <Columns3 size={14} />
          <span className="hidden lg:inline">Colonnes</span>
        </Button>
      )}
    >
      <p className="px-2 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-ad-faint">Colonnes visibles</p>
      {columns
        .filter((c) => c.hideable !== false && !c.primary)
        .map((c) => (
          <div key={c.id} className="rounded-md px-2 py-1.5 hover:bg-ad-hover">
            <Checkbox checked={!hidden.includes(c.id)} onChange={() => toggle(c.id)} label={c.header} className="w-full" />
          </div>
        ))}
      <div className="-mx-1 my-1 h-px bg-ad-border" />
      <button type="button" onClick={() => setHidden(defaults)} className="w-full cursor-pointer rounded-md px-2 py-1.5 text-start text-[13px] text-ad-muted hover:bg-ad-hover hover:text-ad-fg">
        Rétablir par défaut
      </button>
    </Popover>
  );
  return { visible, menu };
}

export function DataTable<T>({
  rows,
  rowId,
  columns,
  loading,
  error,
  onRetry,
  stale,
  sort,
  onSort,
  selected,
  onSelectedChange,
  rowHref,
  onRowClick,
  rowActions,
  empty,
  label,
  skeletonRows = 8,
  rowClassName,
}: {
  rows: T[] | undefined;
  rowId: (r: T) => string;
  columns: Column<T>[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  stale?: boolean;
  sort?: Sort | null;
  onSort?: (key: string) => void;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  rowHref?: (r: T) => string;
  onRowClick?: (r: T) => void;
  rowActions?: (r: T) => MenuItem[];
  empty?: ReactNode;
  label: string;
  skeletonRows?: number;
  rowClassName?: (r: T) => string | undefined;
}) {
  const router = useRouter();
  const selectable = Boolean(selected && onSelectedChange);
  const ids = useMemo(() => (rows ?? []).map(rowId), [rows, rowId]);
  const allOnPage = ids.length > 0 && ids.every((id) => selected?.has(id));
  const someOnPage = ids.some((id) => selected?.has(id));
  const lastClicked = useRef<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const body = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    // keep the roving index valid when the page changes
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp after data change
    setFocusIdx((i) => Math.min(i, Math.max(0, ids.length - 1)));
  }, [ids.length]);

  const toggle = (id: string, idx: number, shift: boolean) => {
    if (!selected || !onSelectedChange) return;
    const next = new Set(selected);
    if (shift && lastClicked.current !== null) {
      const [a, b] = [lastClicked.current, idx].sort((x, y) => x - y);
      const on = !selected.has(id);
      for (const rid of ids.slice(a, b + 1)) (on ? next.add(rid) : next.delete(rid));
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    lastClicked.current = idx;
    onSelectedChange(next);
  };
  const toggleAll = () => {
    if (!selected || !onSelectedChange) return;
    const next = new Set(selected);
    if (allOnPage) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    onSelectedChange(next);
  };

  const open = (r: T, newTab = false) => {
    if (rowHref) {
      if (newTab) window.open(rowHref(r), "_blank", "noopener");
      else router.push(rowHref(r));
    } else onRowClick?.(r);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!rows?.length) return;
    const target = e.target as HTMLElement;
    if (target.closest("button,a,input,[role=checkbox]") && !target.matches("tr")) return;
    const k = e.key;
    let next = focusIdx;
    if (k === "ArrowDown" || k === "j") next = Math.min(rows.length - 1, focusIdx + 1);
    else if (k === "ArrowUp" || k === "k") next = Math.max(0, focusIdx - 1);
    else if (k === "Home") next = 0;
    else if (k === "End") next = rows.length - 1;
    else if (k === "Enter") {
      e.preventDefault();
      return open(rows[focusIdx], e.metaKey || e.ctrlKey);
    } else if ((k === " " || k === "x") && selectable) {
      e.preventDefault();
      return toggle(ids[focusIdx], focusIdx, e.shiftKey);
    } else return;
    e.preventDefault();
    setFocusIdx(next);
    body.current?.querySelectorAll<HTMLElement>("tr[data-row]")[next]?.focus();
  };

  const clickable = Boolean(rowHref || onRowClick);
  const showSkeleton = loading && !rows;
  const isEmpty = !loading && !error && rows && rows.length === 0;

  if (error && !rows) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <div className={cn("relative transition-opacity duration-150", stale && "opacity-60")} aria-busy={loading || stale || undefined}>
      {/* ------------------------------------------------ desktop / tablet table */}
      <div className="ad-scroll hidden overflow-x-auto md:block">
        <table aria-label={label} className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="sticky top-0 z-[1] w-10 border-b border-ad-border bg-ad-panel ps-4 pe-1 text-start">
                  <Checkbox checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={toggleAll} aria-label="Sélectionner toutes les lignes de la page" />
                </th>
              )}
              {columns.map((c, ci) => {
                const active = sort && c.sortKey && sort.key === c.sortKey;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    style={{ width: c.width }}
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "sticky top-0 z-[1] h-9 whitespace-nowrap border-b border-ad-border bg-ad-panel px-3 text-[12px] font-medium text-ad-muted",
                      c.align === "end" ? "text-end" : "text-start",
                      ci === 0 && !selectable && "ps-4",
                    )}
                  >
                    {c.sortKey && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.sortKey!)}
                        className={cn("-mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:text-ad-fg", active && "text-ad-fg", c.align === "end" && "flex-row-reverse")}
                      >
                        {c.header}
                        {active ? sort!.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ChevronsUpDown size={12} className="opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions && <th scope="col" aria-label="Actions" className="sticky top-0 z-[1] w-12 border-b border-ad-border bg-ad-panel pe-3" />}
            </tr>
          </thead>
          <tbody ref={body} onKeyDown={onKeyDown}>
            {showSkeleton &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {selectable && <td className="border-b border-ad-border ps-4" />}
                  {columns.map((c, ci) => (
                    <td key={c.id} className={cn("h-12 border-b border-ad-border px-3", ci === 0 && !selectable && "ps-4")}>
                      <Skeleton className={cn("h-3.5", ci === 0 ? "w-40" : "w-16", c.align === "end" && "ms-auto")} />
                    </td>
                  ))}
                  {rowActions && <td className="border-b border-ad-border" />}
                </tr>
              ))}
            {rows?.map((r, i) => {
              const id = ids[i];
              const isSel = selected?.has(id);
              return (
                <tr
                  key={id}
                  data-row
                  tabIndex={i === focusIdx ? 0 : -1}
                  aria-selected={selectable ? Boolean(isSel) : undefined}
                  onFocus={() => setFocusIdx(i)}
                  onClick={(e) => {
                    if (!clickable) return;
                    // clicks inside portalled menus/dialogs bubble through the React tree; ignore them
                    if (!e.currentTarget.contains(e.target as Node)) return;
                    if ((e.target as HTMLElement).closest("a,button,[role=checkbox],input,[data-no-row-click]")) return;
                    if (window.getSelection()?.toString()) return; // let people copy text
                    open(r, e.metaKey || e.ctrlKey);
                  }}
                  className={cn(
                    "group outline-none transition-colors duration-75 focus-visible:bg-ad-hover",
                    clickable && "cursor-pointer hover:bg-ad-hover",
                    isSel && "bg-ad-subtle",
                    rowClassName?.(r),
                  )}
                >
                  {selectable && (
                    <td className="border-b border-ad-border ps-4 pe-1" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={Boolean(isSel)} onChange={(_, e) => toggle(id, i, (e as React.MouseEvent).shiftKey)} aria-label="Sélectionner la ligne" />
                    </td>
                  )}
                  {columns.map((c, ci) => (
                    <td
                      key={c.id}
                      className={cn(
                        "h-12 border-b border-ad-border px-3 align-middle text-ad-fg",
                        c.align === "end" && "text-end tnum",
                        ci === 0 && !selectable && "ps-4",
                        c.className,
                      )}
                    >
                      {c.cell(r)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="border-b border-ad-border pe-3 text-end" data-no-row-click>
                      <RowMenu items={rowActions(r)} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------ phone list */}
      <ul aria-label={label} className="divide-y divide-ad-border md:hidden">
        {showSkeleton &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="space-y-2 px-4 py-3.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </li>
          ))}
        {rows?.map((r, i) => {
          const id = ids[i];
          const primary = columns.find((c) => c.primary) ?? columns[0];
          const meta = columns.filter((c) => c.mobile && c !== primary);
          // Only the title is the link/button: meta cells may contain their own
          // controls (switches, links), which must not be nested inside it.
          const title = <div className="min-w-0 text-[13.5px] font-medium text-ad-fg">{primary.cell(r)}</div>;
          return (
            <li key={id} className={cn("relative flex items-start gap-3 px-4 py-3", selected?.has(id) && "bg-ad-subtle")}>
              {selectable && (
                <div className="relative z-[1] pt-0.5">
                  <Checkbox checked={Boolean(selected?.has(id))} onChange={(_, e) => toggle(id, i, (e as React.MouseEvent).shiftKey)} aria-label="Sélectionner la ligne" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {rowHref ? (
                  <Link href={rowHref(r)} className="block after:absolute after:inset-0 after:content-['']">
                    {title}
                  </Link>
                ) : onRowClick ? (
                  <button type="button" onClick={() => onRowClick(r)} className="block w-full cursor-pointer text-start after:absolute after:inset-0 after:content-['']">
                    {title}
                  </button>
                ) : (
                  title
                )}
                {meta.length > 0 && (
                  <div className="relative z-[1] mt-1.5 flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ad-muted">
                    {meta.map((c) => (
                      <span key={c.id} className="inline-flex min-w-0 items-center">
                        {c.cell(r)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {(rowHref || onRowClick) && <ChevronRight size={15} className="mt-0.5 shrink-0 self-center text-ad-faint" aria-hidden />}
              {rowActions && (
                <div className="relative z-[1]">
                  <RowMenu items={rowActions(r)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isEmpty && (empty ?? <EmptyState title="Rien à afficher pour le moment" />)}
      {error && rows ? (
        <p role="alert" className="border-t border-ad-border px-4 py-2 text-xs text-ad-red">
          Actualisation impossible : {errorMessage(error)}
        </p>
      ) : null}
    </div>
  );
}

function RowMenu({ items }: { items: MenuItem[] }) {
  return (
    <Menu
      items={items}
      label="Actions de la ligne"
      trigger={(p) => (
        <Button {...p} variant="ghost" size="xs" icon aria-label="Actions de la ligne" className="opacity-70 group-hover:opacity-100">
          <MoreHorizontal size={15} />
        </Button>
      )}
    />
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = [25, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number | undefined;
  onPage: (p: number) => void;
  onPageSize?: (s: number) => void;
  sizes?: number[];
}) {
  const pages = Math.max(1, Math.ceil((total ?? 0) / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total ?? 0, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ad-border px-4 py-2.5 text-[12.5px] text-ad-muted">
      <p className="tnum" aria-live="polite">
        {total === undefined ? "…" : total === 0 ? "Aucun résultat" : `${from}–${to} sur ${total.toLocaleString("fr-FR")}`}
      </p>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <div className="hidden w-[104px] sm:block">
            <Select
              size="sm"
              ariaLabel="Lignes par page"
              value={String(pageSize)}
              onChange={(v) => onPageSize(Number(v))}
              options={sizes.map((s) => ({ value: String(s), label: `${s} par page` }))}
              align="end"
            />
          </div>
        )}
        <span className="tnum hidden sm:inline">
          Page {page} of {pages}
        </span>
        <Button size="sm" icon aria-label="Page précédente" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={15} />
        </Button>
        <Button size="sm" icon aria-label="Page suivante" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}

/** Sticky contextual bar replacing the toolbar while rows are selected. */
export function SelectionBar({ count, onClear, children, totalOnPage }: { count: number; onClear: () => void; children: ReactNode; totalOnPage?: number }) {
  if (count === 0) return null;
  return (
    <div role="region" aria-label="Actions groupées" className="ad-anim-fade flex flex-wrap items-center gap-2 border-b border-ad-border bg-ad-subtle px-4 py-2">
      <span className="tnum text-[13px] font-medium text-ad-fg">
        {count} sélectionné{count > 1 ? "s" : ""}{totalOnPage !== undefined && count > totalOnPage ? " (sur plusieurs pages)" : ""}
      </span>
      <Button size="xs" variant="ghost" onClick={onClear}>
        Effacer
      </Button>
      <div className="ms-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function nextSort(current: Sort | null, key: string, defaultDir: "asc" | "desc" = "desc"): Sort {
  if (!current || current.key !== key) return { key, dir: defaultDir };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}
