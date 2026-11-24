import { Armchair, BatteryCharging, Camera, SprayCan, Tag, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  vision: Camera,
  power: BatteryCharging,
  interior: Armchair,
  care: SprayCan,
};

/** Icon for a category slug; categories added later from the admin get a generic tag. */
export const categoryIcon = (slug: string): LucideIcon => ICONS[slug] ?? Tag;
