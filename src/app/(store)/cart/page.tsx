import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Panier",
};

// Server page shell rendering a client view (same pattern as the product
// detail route). The desktop cart preview navigates here with a cinematic
// push (nav-forward); keeping page.tsx a Server Component lets Next.js
// propagate the incoming transitionTypes so the route transition fires.
export default function CartPage() {
  return <CartView />;
}
