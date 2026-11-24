import { notFound } from "next/navigation";

/** Unknown /admin/* paths render the console 404 (inside the admin shell, not the storefront). */
export default function Missing() {
  notFound();
}
