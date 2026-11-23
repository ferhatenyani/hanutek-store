"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { products } from "@/lib/products";
import { useI18n } from "@/i18n";
import { ProductCard } from "@/components/product-card";
import { HeroVideo } from "@/components/hero-video";
import { NavTransition } from "@/components/nav-transition";

const bestSellers = (() => {
  const best = products.filter((p) => p.bestSeller);
  const fill = products.filter((p) => p.featured && !p.bestSeller);
  return [...best, ...fill].slice(0, 8);
})();

const newArrivals = (() => {
  const taken = new Set(bestSellers.map((p) => p.slug));
  const fresh = products.filter((p) => p.isNew && !taken.has(p.slug));
  const fill = products.filter((p) => !p.isNew && !taken.has(p.slug));
  return [...fresh, ...fill].slice(0, 8);
})();

function ViewAll({ href }: { href: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={href}
      transitionTypes={["nav-forward"]}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-accent-ink transition-colors duration-150 hover:border-foreground/25 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-8">
      <div className="max-w-xl">
        <p className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink rtl:tracking-normal">
          <span className="h-1.5 w-1.5 rounded-[2px] bg-volt" aria-hidden />
          {eyebrow}
        </p>
        <h2 className="text-balance text-2xl font-bold tracking-tight md:text-[28px] rtl:tracking-normal">{title}</h2>
        {sub && <p className="mt-1.5 text-sm leading-relaxed text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export default function HomePage() {
  const { t, m } = useI18n();

  return (
    <NavTransition>
    <div>
      {/* ---------- Hero: brand film ---------- */}
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

      {/* ---------- Categories ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-6 md:pb-20">
        <SectionIntro eyebrow={m.shell.categories} title={m.listing.title} action={<ViewAll href="/products" />} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {(["vision", "power", "interior", "care"] as const).map((slug) => {
            const p = products.find((x) => x.category === slug && (x.bestSeller || x.isNew)) ?? products.find((x) => x.category === slug)!;
            return (
              <Link
                key={slug}
                href={`/products?category=${slug}`}
                transitionTypes={["nav-forward"]}
                className="group relative aspect-[4/5] overflow-hidden rounded-card border border-line transition-colors duration-150 hover:border-faint md:aspect-[3/4]"
              >
                <Image src={p.image} alt="" fill sizes="(min-width: 768px) 24vw, 47vw" className="object-cover" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/20 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-4">
                  <span className="block font-display text-[15px] font-bold text-white">{m.categories[slug].name}</span>
                  <span className="mt-0.5 block text-xs text-white/75">{m.categories[slug].tagline}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

    </div>
    </NavTransition>
  );
}
