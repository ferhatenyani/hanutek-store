"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo, type TargetAndTransition } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/hooks";

export type SheetSide = "bottom" | "left" | "right";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: SheetSide;
  title?: string;
  showTitleBar?: boolean;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}

const panelBySide: Record<SheetSide, string> = {
  bottom:
    "fixed inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-background shadow-2xl",
  left: "fixed inset-y-0 left-0 flex h-dvh w-[86%] max-w-xs flex-col bg-background shadow-2xl",
  right: "fixed inset-y-0 right-0 flex h-dvh w-full max-w-md flex-col bg-background shadow-2xl",
};

const motionBySide: Record<
  SheetSide,
  {
    initial: TargetAndTransition;
    drag: "x" | "y";
    constraints: { top?: number; bottom?: number; left?: number; right?: number };
    shouldClose: (info: PanInfo) => boolean;
  }
> = {
  bottom: {
    initial: { y: "100%" },
    drag: "y",
    constraints: { top: 0, bottom: 0 },
    shouldClose: (info) => info.offset.y > 80 || info.velocity.y > 500,
  },
  left: {
    initial: { x: "-100%" },
    drag: "x",
    constraints: { left: 0, right: 0 },
    shouldClose: (info) => info.offset.x < -60 || info.velocity.x < -400,
  },
  right: {
    initial: { x: "100%" },
    drag: "x",
    constraints: { left: 0, right: 0 },
    shouldClose: (info) => info.offset.x > 60 || info.velocity.x > 400,
  },
};

/**
 * Edge-anchored sheet: slides from the bottom on mobile, from the sides for
 * drawers/panels. Backdrop fades in sync; panels are swipe-dismissible.
 */
export function Sheet({
  open,
  onClose,
  side = "bottom",
  title,
  showTitleBar = true,
  children,
  className,
  panelClassName,
}: SheetProps) {
  const hydrated = useHydrated();
  const cfg = motionBySide[side];

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!hydrated) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 z-[80]", className)} role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
          />
          <motion.div
            className={cn(panelBySide[side], panelClassName)}
            initial={cfg.initial}
            animate={{ x: 0, y: 0 }}
            exit={{ ...cfg.initial, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }}
            transition={{ type: "spring", damping: 30, stiffness: 380, mass: 0.8 }}
            drag={cfg.drag}
            dragConstraints={cfg.constraints}
            dragElastic={0.12}
            dragDirectionLock
            onDragEnd={(_, info) => cfg.shouldClose(info) && onClose()}
          >
            {side === "bottom" && (
              <div className="flex justify-center pt-3 pb-1" aria-hidden>
                <div className="h-1 w-10 rounded-full bg-line" />
              </div>
            )}
            {title && showTitleBar && (
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-base font-semibold tracking-tight">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  <X size={17} />
                </button>
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}