import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductsBrowser } from "./browser";

export const metadata: Metadata = { title: "All products" };

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-surface" />
          <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-card bg-surface" />
            ))}
          </div>
        </div>
      }
    >
      <ProductsBrowser />
    </Suspense>
  );
}