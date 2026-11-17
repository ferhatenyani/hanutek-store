"use client";

import Link from "next/link";
import { ArrowUp, AtSign, Play } from "lucide-react";
import { useState, type FormEvent } from "react";
import { categories } from "@/lib/products";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useSheetUI } from "./app-shell";

export function Footer() {
  const toast = useToast();
  const { user } = useStore();
  const { openCart } = useSheetUI();
  const [email, setEmail] = useState("");

  const subscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmail("");
    toast("Subscribed — demo only, no emails sent");
  };

  return (
    <footer className="bg-accent pb-24 text-background md:pb-0">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
          <div>
            <Link href="/" transitionTypes={["nav-forward"]} className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-volt font-mono text-sm text-accent">
                h
              </span>
              <span className="text-[17px] font-semibold tracking-tight">
                hanutek<span className="text-volt">.</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-background/70">
              Considered gadgets and accessories for people who love their cars. Tested on real roads, built to last.
            </p>
            <div className="mt-5 flex gap-2">
              {[
                { icon: AtSign, label: "Instagram" },
                { icon: Play, label: "YouTube" },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  aria-label={s.label}
                  onClick={() => toast("Social links are mocked in this demo")}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-background/20 bg-background/10 text-background/70 transition-colors hover:border-volt/60 hover:text-volt"
                >
                  <s.icon size={16} />
                </button>
              ))}
            </div>
          </div>

          <nav aria-label="Shop">
            <h3 className="mb-4 font-mono text-[11px] tracking-[0.18em] text-volt uppercase">Shop</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/products" transitionTypes={["nav-forward"]} className="text-background/70 transition-colors hover:text-volt">
                  All products
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/products?category=${c.slug}`}
                    transitionTypes={["nav-forward"]}
                    className="text-background/70 transition-colors hover:text-volt"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h3 className="mb-4 font-mono text-[11px] tracking-[0.18em] text-volt uppercase">Account</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href={user ? "/profile" : "/login"} transitionTypes={["nav-forward"]} className="text-background/70 transition-colors hover:text-volt">
                  {user ? "Your profile" : "Sign in"}
                </Link>
              </li>
              {!user && (
                <li>
                  <Link href="/register" transitionTypes={["nav-forward"]} className="text-background/70 transition-colors hover:text-volt">
                    Create account
                  </Link>
                </li>
              )}
              <li>
                <Link href="/cart" transitionTypes={["nav-forward"]} className="text-background/70 transition-colors hover:text-volt">
                  Cart
                </Link>
              </li>
              <li>
                <button type="button" onClick={openCart} className="cursor-pointer text-muted transition-colors hover:text-foreground">
                  Quick cart
                </button>
              </li>
            </ul>
          </nav>

          <div>
            <h3 className="mb-4 font-mono text-[11px] tracking-[0.18em] text-volt uppercase">Stay in the loop</h3>
            <p className="mb-3 text-sm text-muted">New drops and road-tested picks. No spam.</p>
            <form onSubmit={subscribe} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Email address"
                className="h-11 min-w-0 flex-1 rounded-full border border-background/20 bg-background/10 px-4 text-sm text-background placeholder:text-background/40 focus:border-volt focus:outline-none"
              />
              <button
                type="submit"
                className="h-11 shrink-0 cursor-pointer rounded-full bg-volt px-5 text-sm font-medium text-accent transition-colors hover:bg-[#c8e01e]"
              >
                Join
              </button>
            </form>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {["Visa", "Mastercard", "Amex", "PayPal"].map((p) => (
                <span key={p} className="rounded-md border border-background/20 bg-background/10 px-2 py-1 font-mono text-[10px] text-background/70">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-background/15 pt-6 text-xs text-background/50 sm:flex-row sm:items-center">
          <p>© 2026 Hanutek. Frontend demo — all products, orders and payments are mocked.</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-volt"
          >
            Back to top <ArrowUp size={13} />
          </button>
        </div>
      </div>
    </footer>
  );
}