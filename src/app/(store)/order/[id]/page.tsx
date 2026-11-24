import { Suspense } from "react";
import type { Metadata } from "next";
import { OrderView } from "./view";

export const metadata: Metadata = { title: "Order" };

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-surface" />
        </div>
      }
    >
      <OrderView />
    </Suspense>
  );
}