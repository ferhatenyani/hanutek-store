"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Nice round axis maximum and ticks. */
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: 1, step: 1 / ticks };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { max: step * ticks, step };
}

export interface Point {
  x: string;
  y: number;
  /** comparison series (e.g. order count) shown in the tooltip only */
  extra?: ReactNode;
}

/**
 * Single-series trend (line + flat fill) with y gridlines, sparse x labels
 * and a keyboard/pointer crosshair. Accessible summary via a visually
 * hidden table.
 */
export function TrendChart({
  data,
  height = 220,
  formatY,
  formatX,
  label,
}: {
  data: Point[];
  height?: number;
  formatY: (v: number) => string;
  formatX: (x: string) => string;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const clip = useId();
  const padL = 56;
  const padR = 8;
  const padT = 10;
  const padB = 26;
  const iw = Math.max(0, width - padL - padR);
  const ih = height - padT - padB;
  const { max, step } = useMemo(() => niceScale(Math.max(0, ...data.map((d) => d.y))), [data]);
  const x = (i: number) => padL + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.y).toFixed(1)}`).join("");
  const area = data.length ? `${line}L${x(data.length - 1).toFixed(1)},${padT + ih}L${x(0).toFixed(1)},${padT + ih}Z` : "";
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 64))));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - padL;
    const i = Math.round((px / Math.max(1, iw)) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1));
            if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? data.length) - 1));
            if (e.key === "Escape") setHover(null);
          }}
          onBlur={() => setHover(null)}
          className="block touch-pan-y outline-none"
        >
          <defs>
            <clipPath id={clip}>
              <rect x={padL} y={0} width={iw} height={height} />
            </clipPath>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--ad-border)" strokeDasharray={t === 0 ? undefined : "2 3"} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ad-faint)" className="tnum">
                {formatY(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            (i % labelEvery === 0 && data.length - 1 - i >= labelEvery * 0.6) || i === data.length - 1 ? (
              <text key={d.x} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--ad-faint)">
                {formatX(d.x)}
              </text>
            ) : null,
          )}
          <g clipPath={`url(#${clip})`}>
            <path d={area} fill="var(--ad-chart)" fillOpacity={0.06} />
            <path d={line} fill="none" stroke="var(--ad-chart)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="var(--ad-border-strong)" />
              <circle cx={x(hover)} cy={y(h.y)} r={4} fill="var(--ad-panel)" stroke="var(--ad-chart)" strokeWidth={1.75} />
            </g>
          )}
        </svg>
      )}
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-32 rounded-md border border-ad-border bg-ad-panel px-2.5 py-2 text-xs shadow-ad-pop"
          style={{ left: Math.min(Math.max(0, x(hover) - 64), Math.max(0, width - 140)) }}
        >
          <p className="text-ad-muted">{formatX(h.x)}</p>
          <p className="tnum mt-0.5 font-medium text-ad-fg">{formatY(h.y)}</p>
          {h.extra && <p className="mt-0.5 text-ad-muted">{h.extra}</p>}
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.x}>
              <th>{formatX(d.x)}</th>
              <td>{formatY(d.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ranked horizontal bars (top products, regions). */
export function BarList({ items, format, empty = "No data for this period" }: { items: { key: string; label: ReactNode; value: number; href?: string; sub?: ReactNode }[]; format: (v: number) => string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-8 text-center text-[13px] text-ad-muted">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((it) => {
        const inner = (
          <>
            <span aria-hidden className="absolute inset-y-0 start-0 rounded-[5px] bg-ad-subtle transition-[width] duration-500" style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
            <span className="relative flex min-w-0 items-center gap-2 truncate">
              <span className="truncate">{it.label}</span>
              {it.sub && <span className="shrink-0 text-ad-faint">{it.sub}</span>}
            </span>
            <span className="tnum relative shrink-0 font-medium">{format(it.value)}</span>
          </>
        );
        const cls = "relative flex h-8 items-center justify-between gap-3 px-2.5 text-[13px] text-ad-fg";
        return (
          <li key={it.key}>
            {it.href ? (
              <Link href={it.href} className={cn(cls, "rounded-[5px] hover:bg-ad-hover/50")}>
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const SEG_TONE: Record<string, string> = {
  neutral: "var(--ad-faint)",
  green: "var(--ad-green)",
  amber: "var(--ad-amber)",
  red: "var(--ad-red)",
  blue: "var(--ad-blue)",
  violet: "var(--ad-violet)",
};

/** Stacked proportion bar + legend. */
export function SegmentBar({ segments }: { segments: { key: string; label: string; value: number; tone: string; href?: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-ad-subtle" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => <span key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: SEG_TONE[s.tone] }} className="h-full first:rounded-s-full last:rounded-e-full" />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {segments.map((s) => {
          const body = (
            <>
              <span className="flex min-w-0 items-center gap-2 text-ad-muted">
                <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: SEG_TONE[s.tone] }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="tnum font-medium text-ad-fg">{s.value}</span>
            </>
          );
          return (
            <li key={s.key}>
              {s.href ? (
                <Link href={s.href} className="-mx-1.5 flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-[13px] hover:bg-ad-hover">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-2 text-[13px]">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Tiny inline trend (KPI cards). */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} aria-hidden className="block overflow-visible">
      <path d={d} fill="none" stroke="var(--ad-faint)" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
