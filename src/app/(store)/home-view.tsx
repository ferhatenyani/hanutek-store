"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProductDTO } from "@/lib/api-types";
import { useI18n } from "@/i18n";
import { ProductCard } from "@/components/product-card";
import { HeroVideo } from "@/components/hero-video";
import { NavTransition } from "@/components/nav-transition";

function ViewAll({ href }: { href: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={href}
      transitionTypes={["nav-forward"]}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap h-8 rounded-full border border-line bg-surface px-3 text-[13px] font-medium sm:h-auto sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm text-accent-ink transition-colors duration-150 hover:border-foreground/25 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      {t("home.viewAll")}
      <ArrowRight size={14} className="rtl:-scale-x-100" />
    </Link>
  );
}

function SectionIntro({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 md:mb-8">
      <p className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink rtl:tracking-normal">
        <span className="h-1.5 w-1.5 rounded-[2px] bg-volt" aria-hidden />
        {eyebrow}
      </p>
      {/* the action rides on the title row at every width; the title wraps
          (min-w-0) before the button is ever pushed onto its own line */}
      <div className="flex items-center justify-between gap-3 md:gap-6">
        <h2 className="min-w-0 text-balance text-[22px] font-bold leading-tight tracking-tight sm:text-2xl md:text-[28px] rtl:tracking-normal">
          {title}
        </h2>
        {/* negative margin: the pill is a few px taller than one title line; without
            this it sets the row height and shoves the subtitle down under it */}
        {action && <div className="-my-1.5 shrink-0 sm:-my-1">{action}</div>}
      </div>
      {sub && <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

export function HomeView({ bestSellers, newArrivals }: { bestSellers: ProductDTO[]; newArrivals: ProductDTO[] }) {
  const { t, m } = useI18n();

  return (
    <NavTransition>
    <div>
      {/* ---------- Hero: brand film ---------- */}
      {/* the film carries no text: this is the page's heading for screen readers and search engines */}
      <h1 className="sr-only">
        hanutek — {m.home.heroTitleA} {m.home.heroTitleB}
      </h1>
      <HeroVideo />

      {/* ---------- Best sellers ---------- */}
      <section id="best" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 md:px-6 md:py-16">
        <SectionIntro
          eyebrow={t("common.bestSeller")}
          title={m.home.bestTitle}
          sub={m.home.bestSub}
          action={<ViewAll href="/products" />}
        />
        <div className="product-rail no-scrollbar" data-scroll-key="home-best">
          {bestSellers.map((p, i) => (
            <ProductCard key={p.slug} product={p} priority={i < 2} />
          ))}
        </div>
      </section>

      {/* ---------- New arrivals ---------- */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <SectionIntro
            eyebrow={t("common.new")}
            title={m.home.newTitle}
            sub={m.home.newSub}
            action={<ViewAll href="/products" />}
          />
          <div className="product-rail no-scrollbar" data-scroll-key="home-new">
            {newArrivals.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      </section>

    </div>
    </NavTransition>
  );
}
