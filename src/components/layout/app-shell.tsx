"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/ui/toast";
import { LocaleProvider } from "@/i18n";
import { Header } from "./header";
import { Footer } from "./footer";
import { DockNav } from "./dock-nav";
import { CartSheet } from "./cart-sheet";
import { NavigationTracker } from "@/components/product-morph";

interface SheetUI {
  cartOpen: boolean;
  openCart: () => void;
  closeAll: () => void;
}

const SheetUIContext = createContext<SheetUI | null>(null);

export function useSheetUI(): SheetUI {
  const ctx = useContext(SheetUIContext);
  if (!ctx) throw new Error("useSheetUI must be used inside <AppShell>");
  return ctx;
}

function Shell({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const ui: SheetUI = {
    cartOpen,
    openCart: () => setCartOpen(true),
    closeAll: () => setCartOpen(false),
  };

  return (
    <SheetUIContext.Provider value={ui}>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        {/* clearance so the floating dock never covers the footer (phones + tablets) */}
        <div aria-hidden className="h-24 lg:hidden" />
        <DockNav />
      </div>
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
      {/* last in the tree: its layout effect runs after Next's scroll handling */}
      <NavigationTracker />
    </SheetUIContext.Provider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <StoreProvider>
        <ToastProvider>
          <MotionConfig reducedMotion="user">
            <Shell>{children}</Shell>
          </MotionConfig>
        </ToastProvider>
      </StoreProvider>
    </LocaleProvider>
  );
}
