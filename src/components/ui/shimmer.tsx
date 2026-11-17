import type { CSSProperties } from "react";

/**
 * Magic UI `shimmer-button` perimeter spark, adapted as a decorative overlay so
 * it can live inside a next/link (keeps prefetch + instant navigation) or a
 * plain button. Host element must be `relative z-0 overflow-hidden rounded-full`.
 */
export function Shimmer({
  color = "#ffffff",
  duration = "3s",
  cut = "0.05em",
  background = "var(--accent)",
}: {
  /** Spark colour (the travelling light). */
  color?: string;
  /** One perimeter pass duration. */
  duration?: string;
  /** Border thickness the spark peeks through. */
  cut?: string;
  /** Must match the host element's background so the interior stays solid. */
  background?: string;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={
        {
          "--shimmer-color": color,
          "--speed": duration,
          "--cut": cut,
          "--bg": background,
        } as CSSProperties
      }
    >
      {/* spark container */}
      <span className="@container-[size] absolute inset-0 -z-30 overflow-visible blur-[1px]">
        <span className="animate-shimmer-slide absolute inset-0 aspect-[1] h-[100cqh]">
          <span className="animate-spin-around absolute -inset-full [background:conic-gradient(from_calc(270deg-(90deg*0.5)),transparent_0,var(--shimmer-color)_90deg,transparent_90deg)]" />
        </span>
      </span>
      {/* backdrop: solid interior, leaves only the perimeter ring visible */}
      <span className="absolute inset-(--cut) -z-20 rounded-full [background:var(--bg)]" />
    </span>
  );
}
