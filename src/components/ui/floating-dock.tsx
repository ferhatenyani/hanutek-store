"use client";
/**
 * FloatingDock — bottom navigation dock on mobile phones AND tablets
 * (lg:hidden wrapper). Active state is an icon/color change plus a sliding
 * accent pill; icons keep a constant size (no hover magnification, no
 * active-state enlarge morph).
 */
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

export type DockItem = {
  title: string;
  icon: React.ReactNode;
  href?: string;
  /** Action items (e.g. the cart trigger) open UI instead of navigating. */
  onClick?: () => void;
  active?: boolean;
  badge?: number;
  /** View-transition navigation types (see nav-transition.tsx). */
  transitionTypes?: string[];
};

export const FloatingDock = ({
  items,
  desktopClassName,
}: {
  items: DockItem[];
  desktopClassName?: string;
}) => {
  return <FloatingDockDesktop items={items} className={desktopClassName} />;
};

const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: DockItem[];
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "mx-auto flex h-16 items-end gap-2 rounded-2xl bg-gray-50 px-3 pb-3 shadow-lift min-[360px]:gap-4 min-[360px]:px-4 dark:bg-neutral-900",
        className,
      )}
    >
      {items.map((item) => (
        <IconContainer key={item.title} {...item} />
      ))}
    </div>
  );
};

function IconContainer({ title, icon, href, onClick, active, badge, transitionTypes }: DockItem) {
  const [hovered, setHovered] = useState(false);

  const inner = (
    <div
      // mouse only: iOS/Android fire emulated mouse events on tap, which left
      // the label tooltip stuck on screen after every tap ("sticky hover")
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        "relative grid h-10 w-10 place-items-center rounded-full",
        active
          ? "text-background"
          : "bg-gray-200 text-neutral-700 dark:bg-neutral-800 dark:text-white",
      )}
    >
      {/* Active indicator slides between items; size never changes. */}
      {active && (
        <motion.span
          layoutId="dock-active-pill"
          className="absolute inset-0 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 2, x: "-50%" }}
            className="absolute -top-8 left-1/2 z-10 w-fit rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white"
          >
            {title}
          </motion.div>
        )}
      </AnimatePresence>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -end-1 -top-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sale px-1 font-mono text-[10px] font-medium text-white">
          {badge}
        </span>
      )}
      <span className="relative z-[1] flex items-center justify-center">{icon}</span>
    </div>
  );

  if (!href) {
    return (
      <button type="button" onClick={onClick} aria-label={title} className="cursor-pointer">
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={href}
      transitionTypes={transitionTypes}
      aria-label={title}
      aria-current={active ? "page" : undefined}
    >
      {inner}
    </Link>
  );
}
