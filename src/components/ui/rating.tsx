import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  size = 13,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  const pct = (Math.max(0, Math.min(5, value)) / 5) * 100;
  const row = (filled: boolean) => (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={filled ? 0 : 1.5}
          fill={filled ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} role="img" aria-label={`${value.toFixed(1)} / 5`}>
      <span className="relative inline-flex leading-none" aria-hidden>
        <span className="text-faint">{row(false)}</span>
        <span className="absolute inset-0 overflow-hidden text-foreground" style={{ width: `${pct}%` }}>
          {row(true)}
        </span>
      </span>
      <span className="num text-xs font-semibold text-foreground">{value.toFixed(1)}</span>
      {count != null && <span className="num text-xs text-faint">({count})</span>}
    </span>
  );
}