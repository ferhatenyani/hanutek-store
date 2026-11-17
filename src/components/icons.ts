import { Armchair, BatteryCharging, Camera, SprayCan, type LucideIcon } from "lucide-react";
import type { CategorySlug } from "@/lib/products";

export const categoryIcons: Record<CategorySlug, LucideIcon> = {
  vision: Camera,
  power: BatteryCharging,
  interior: Armchair,
  care: SprayCan,
};