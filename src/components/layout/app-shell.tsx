"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/ui/toast";
import { LocaleProvider } from "@/i18n";
import { Header } from "./header";
import { Footer } from "./footer";
import { BottomNav } from "./bottom-nav";
import { CartSheet } from "./cart-sheet";
import { SearchSheet } from "./search-sheet";
import { MenuSheet } from "./menu-sheet";

interface SheetUI {
  cartOpen: boolean;
  searchOpen: boolean;
  menuOpen: boolean;
  openCart: () => void;
  openSearch: () => void;
  openMenu: () => void;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeAll = () => {
    setCartOpen(false);
    setSearchOpen(false);
    setMenuOpen(false);
  };
  const ui: SheetUI = {
    cartOpen,
    searchOpen,
    menuOpen,
    openCart: () => {
      closeAll();
      setCartOpen(true);
    },
    openSearch: () => {
      closeAll();
      setSearchOpen(true);
    },
    openMenu: () => {
      closeAll();
      setMenuOpen(true);
    },
    closeAll,
  };

  return (
    <SheetUIContext.Provider value={ui}>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        {/* clearance so the floating dock never permanently covers the footer */}
        <div aria-hidden className="h-24 md:hidden" />
        <BottomNav />
      </div>
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
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
