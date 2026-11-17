"use client";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const current: Record<Size, string> = {
  sm: "text-sm",
  md: "text-[15px]",
  lg: "text-xl",
  xl: "text-3xl",
};
const compare: Record<Size, string> = {
  sm: "text-xs",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-base",
};

export function Price({
  value,
  compareAt,
  size = "md",
  className,
}: {
  value: number;
  compareAt?: number;
  size?: Size;
  className?: string;
}) {
  const { price: fmt } = useI18n();
  const onSale = compareAt != null && compareAt > value;
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("num font-bold tracking-tight text-foreground", current[size])}>{fmt(value)}</span>
      {onSale && (
        <span className={cn("num text-faint line-through", compare[size])}>{fmt(compareAt!)}</span>
      )}
    </span>
  );
}