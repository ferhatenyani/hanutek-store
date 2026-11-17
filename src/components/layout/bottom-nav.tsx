"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, Search, ShoppingBag, UserRound } from "lucide-react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useSheetUI } from "./app-shell";

/* Floating dock — adapted from Magic UI's FloatingDock magnification physics
   (mouseX -> distance -> spring), reshaped into a floating mobile nav pill.
   On touch there is no hover, so the sliding ink pill carries the active state;
   on pointer devices the icons magnify under the cursor. */

const DISTANCE = 110;
const MAG = 1.3;

type Item = {
  key: string;
  label: string;
  icon: typeof House;
  href?: string;
  active: boolean;
  badge?: number;
  avatar?: string;
};

function DockItem({
  item,
  mouseX,
  onClick,
}: {
  item: Item;
  mouseX: MotionValue<number>;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const distance = useTransform(mouseX, (val) => {
    const b = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - b.x - b.width / 2;
  });
  const scaleT = useTransform(distance, [-DISTANCE, 0, DISTANCE], [1, MAG, 1]);
  const scale = useSpring(scaleT, { mass: 0.1, stiffness: 170, damping: 14 });
  const Icon = item.icon;

  const inner = (
    <>
      <span ref={ref} className="relative grid h-10 w-10 place-items-center">
        {item.active && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
            className="absolute inset-0 rounded-full bg-accent"
          />
        )}
        <motion.span style={{ scale }} className="relative z-10 grid place-items-center">
          {item.avatar ? (
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold",
                item.active ? "bg-volt text-foreground" : "bg-accent-soft text-accent-ink",
              )}
            >
              {item.avatar}
            </span>
          ) : (
            <Icon
              size={20}
              strokeWidth={item.active ? 2.3 : 2}
              className={cn(
                "transition-colors duration-200",
                item.active ? "text-white" : "text-muted",
              )}
            />
          )}
          {item.badge != null && item.badge > 0 && (
            <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-volt px-1 text-[9px] font-bold text-foreground">
              {item.badge}
            </span>
          )}
        </motion.span>
      </span>
      <span
        className={cn(
          "text-[9.5px] leading-none transition-colors duration-200",
          item.active ? "font-semibold text-foreground" : "text-muted",
        )}
      >
        {item.label}
      </span>
    </>
  );

  const cls =
    "relative flex w-[54px] cursor-pointer flex-col items-center gap-1 rounded-2xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60";

  if (item.href) {
    return (
      <Link href={item.href} aria-current={item.active ? "page" : undefined} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={item.label} className={cls}>
      {inner}
    </button>
  );
}

export function BottomNavView({
  cartCount,
  signedIn,
  initial,
}: {
  cartCount: number;
  signedIn: boolean;
  initial: string;
}) {
  const pathname = usePathname();
  const { openSearch, openCart } = useSheetUI();
  const { m } = useI18n();
  const mouseX = useMotionValue(Infinity);

  const items: (Item & { action?: "search" | "cart" })[] = [
    { key: "home", label: m.nav.home, icon: House, href: "/", active: pathname === "/" },
    {
      key: "shop",
      label: m.nav.shop,
      icon: LayoutGrid,
      href: "/products",
      active: pathname.startsWith("/products"),
    },
    { key: "search", label: m.nav.search, icon: Search, action: "search", active: false },
    { key: "cart", label: m.nav.cart, icon: ShoppingBag, action: "cart", active: false, badge: cartCount },
    {
      key: "account",
      label: m.nav.account,
      icon: UserRound,
      href: signedIn ? "/profile" : "/login",
      active: pathname.startsWith("/profile"),
      avatar: signedIn ? initial : undefined,
    },
  ];

  return (
    <nav
      aria-label={m.nav.menu}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
    >
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="pointer-events-auto flex items-end gap-0.5 rounded-full border border-line bg-surface/90 p-1.5 shadow-lift backdrop-blur-xl"
      >
        {items.map((it) => (
          <DockItem
            key={it.key}
            item={it}
            mouseX={mouseX}
            onClick={it.action === "search" ? openSearch : it.action === "cart" ? openCart : undefined}
          />
        ))}
      </motion.div>
    </nav>
  );
}

export function BottomNav() {
  const { cartCount, user, ready } = useStore();
  return (
    <BottomNavView
      cartCount={ready ? cartCount : 0}
      signedIn={ready && !!user}
      initial={user?.name.charAt(0).toUpperCase() ?? ""}
    />
  );
}
