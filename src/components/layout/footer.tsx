"use client";

import Link from "next/link";
import { ArrowUp, AtSign, Banknote, MapPin, Play } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { tr, useCategoryList } from "@/lib/catalog-client";
import { useI18n } from "@/i18n";
import { useToast } from "@/components/ui/toast";
import { useSheetUI } from "./app-shell";
import { LocaleToggle } from "./header";
import { navTypes } from "@/components/nav-transition";
import { usePathname } from "next/navigation";

export function Footer() {
  const toast = useToast();
  const { user } = useStore();
  const { m, locale } = useI18n();
  const categories = useCategoryList();
  const { openCart } = useSheetUI();
  const pathname = usePathname() ?? "";
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const f = m.footer;
  const year = "2026";

  const subscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || subscribing) return;
    setSubscribing(true);
    try {
      await api("/newsletter", { method: "POST", body: { email: email.trim(), locale } });
      setEmail("");
      toast(f.subscribedToast);
    } catch {
      toast(m.common.actionFailed);
    } finally {
      setSubscribing(false);
    }
  };

  const linkCls = "text-background/70 transition-colors duration-150 hover:text-volt";
  const headCls = "mb-4 font-mono text-[11px] tracking-[0.18em] text-volt uppercase";
  const legal = [f.contact, f.faq, f.shipping, f.terms, f.privacy];

  return (
    <footer className="bg-accent pb-24 text-background md:pb-0">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-16">
        <div className="grid gap-10 [&>*]:min-w-0 md:grid-cols-[1.6fr_1fr_1fr_1.6fr]">
          {/* Brand */}
          <div>
            <Link href="/" transitionTypes={navTypes(pathname, "/")} className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-volt font-mono text-sm text-accent">
                h
              </span>
              <span className="text-[17px] font-semibold tracking-tight">
                hanutek<span className="text-volt">.</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-background/70">{f.tagline}</p>
            <div className="mt-5 flex gap-2">
              {[
                { icon: AtSign, label: "Instagram" },
                { icon: Play, label: "YouTube" },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  aria-label={s.label}
                  onClick={() => toast(f.comingSoon)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-background/20 bg-background/10 text-background/70 transition-colors duration-150 hover:border-volt/60 hover:text-volt"
                >
                  <s.icon size={16} />
                </button>
              ))}
            </div>
            <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-volt/30 bg-volt/10 px-3 py-1 text-xs text-volt">
              <MapPin size={13} /> {f.madeIn}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-background/20 bg-background/10 px-3 py-1 text-xs text-background/80">
              <Banknote size={13} /> {f.paymentNote}
            </p>
          </div>

          {/* Shop */}
          <nav aria-label={f.shop}>
            <h3 className={headCls}>{f.shop}</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/products" transitionTypes={navTypes(pathname, "/products")} className={linkCls}>
                  {m.nav.allProducts}
                </Link>
              </li>
              <li>
                <Link href="/favorites" transitionTypes={navTypes(pathname, "/favorites")} className={linkCls}>
                  {m.nav.favorites}
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/products?category=${c.slug}`} transitionTypes={navTypes(pathname, `/products?category=${c.slug}`)} className={linkCls}>
                    {tr(c.name, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Account */}
          <nav aria-label={m.nav.account}>
            <h3 className={headCls}>{m.nav.account}</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href={user ? "/profile" : "/login"} transitionTypes={navTypes(pathname, user ? "/profile" : "/login")} className={linkCls}>
                  {user ? m.nav.account : m.auth.loginTitle}
                </Link>
              </li>
              {!user && (
                <li>
                  <Link href="/register" transitionTypes={navTypes(pathname, "/register")} className={linkCls}>
                    {m.auth.registerTitle}
                  </Link>
                </li>
              )}
              <li>
                <Link href="/profile?tab=orders" transitionTypes={navTypes(pathname, "/profile?tab=orders")} className={linkCls}>
                  {m.nav.orders}
                </Link>
              </li>
              <li>
                <Link href="/cart" transitionTypes={navTypes(pathname, "/cart")} className={linkCls}>
                  {m.nav.cart}
                </Link>
              </li>
              <li>
                <button type="button" onClick={openCart} className={`cursor-pointer ${linkCls}`}>
                  {f.quickCart}
                </button>
              </li>
            </ul>
          </nav>

          {/* Newsletter */}
          <div>
            <h3 className={headCls}>{f.newsletterTitle}</h3>
            <p className="mb-3 text-sm text-background/70">{f.newsletterBody}</p>
            <form onSubmit={subscribe} className="flex flex-wrap gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={f.newsletterPlaceholder}
                aria-label={f.newsletterPlaceholder}
                className="h-11 min-w-0 flex-1 rounded-full border border-background/20 bg-background/10 px-4 text-sm text-background placeholder:text-background/60 focus:border-volt focus:outline-none"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="h-11 shrink-0 cursor-pointer rounded-full bg-volt px-5 text-sm font-medium text-accent transition-colors duration-150 hover:bg-[#c8e01e] disabled:opacity-60"
              >
                {f.newsletterCta}
              </button>
            </form>
            <div className="mt-5 lg:hidden">
              <LocaleToggle />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 space-y-4 border-t border-background/15 pt-6">
          <nav aria-label={f.legal} className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {legal.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toast(f.comingSoon)}
                className="cursor-pointer text-background/60 transition-colors duration-150 hover:text-volt"
              >
                {l}
              </button>
            ))}
          </nav>
          <div className="flex flex-col items-start justify-between gap-3 text-xs text-background/60 sm:flex-row sm:items-center">
            <p>{f.copyright.replace("{year}", year)}</p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex cursor-pointer items-center gap-1.5 transition-colors duration-150 hover:text-volt"
            >
              {f.backToTop} <ArrowUp size={13} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
