import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Panier",
};

// Server page shell rendering a client view (same pattern as the product
// detail route). Keeping page.tsx a Server Component lets Next.js propagate
// the incoming `transitionTypes` (to-cart) so the shared-element morph and
// bottom-sheet entrance actually fire — a fully "use client" page drops them.
export default function CartPage() {
  return <CartView />;
}
