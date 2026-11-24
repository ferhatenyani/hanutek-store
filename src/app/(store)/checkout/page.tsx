import { redirect } from "next/navigation";

/**
 * The checkout form is no longer its own page (A3): it lives below the cart
 * lines on /cart and inside the expanded cart sheet, so "Proceed to checkout"
 * is a scroll inside one document instead of a route remount. Old deep links
 * and refreshes land back on the cart at the form.
 */
export default function CheckoutPage() {
  redirect("/cart#checkout");
}
