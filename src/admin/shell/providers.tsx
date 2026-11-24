"use client";

import type { ReactNode } from "react";
import { ConfirmProvider, ToastProvider } from "../ui/overlay";
import { useTheme } from "./theme";

function ThemeSync() {
  useTheme();
  return null;
}

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ThemeSync />
        {children}
      </ConfirmProvider>
    </ToastProvider>
  );
}
