"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { products, variantPrice } from "@/lib/products";
import { useI18n } from "@/i18n";
import { buttonClasses, Badge } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { Shimmer } from "@/components/ui/shimmer";
import { BorderBeam } from "@/components/ui/border-beam";
import { ProductCard } from "@/components/product-card";
import { NavTransition } from "@/components/nav-transition";

const hero = products.find((p) => p.slug === "roadeye-dual-dash-cam")!;
const spotlight = products.find((p) => p.slug === "jumpcore-1000-starter")!;

const bestSellers = (() => {
  const best = products.filter((p) => p.bestSeller);
  const fill = products.filter((p) => p.featured && !p.bestSeller);
  return [...best, ...fill].slice(0, 4);
})();

const newArrivals = (() => {
  const taken = new Set(bestSellers.map((p) => p.slug));
  const fresh = products.filter((p) => p.isNew && !taken.has(p.slug));
  const fill = products.filter((p) => !p.isNew && !taken.has(p.slug));
  return [...fresh, ...fill].slice(0, 4);
})();

const trustIcons = [Truck, ShieldCheck, RotateCcw, Headphones];

function ViewAll({ href }: { href: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={href}
      transitionTypes={["nav-forward"]}
      className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-accent-ink transition-colors duration-200 hover:border-foreground/25 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
    >
      {t("home.viewAll")}
      <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
      <div className="max-w-xl">
        <p className="mb-2.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink rtl:tracking-normal">
          <span className="h-1.5 w-1.5 rounded-[2px] bg-volt" aria-hidden />
          {eyebrow}
        </p>
        <h2 className="text-balance text-2xl font-bold tracking-tight md:text-[30px] rtl:tracking-normal">{title}</h2>
        {sub && <p className="mt-2 text-sm leading-relaxed text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export default function HomePage() {
  const { t, m, price } = useI18n();
  const heroMsg = m.products[hero.slug as keyof typeof m.products];

  return (
    <NavTransition>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-foreground text-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(212,236,36,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(212,236,36,0.7) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(760px circle at 84% 8%, rgba(212,236,36,0.16), transparent 62%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          {/* headline band */}
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <BlurFade duration={0.5}>
                <p className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-volt/30 bg-volt/10 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-volt rtl:tracking-normal">
                  <span className="h-1.5 w-1.5 rounded-full bg-volt" aria-hidden />
                  {m.home.heroEyebrow}
                </p>
              </BlurFade>
              <BlurFade duration={0.55}>
                <h1 className="text-balance text-[42px] font-bold leading-[1.03] tracking-[-0.03em] md:text-[68px] rtl:tracking-normal">
                  <span className="block text-background">{m.home.heroTitleA}</span>
                  <span className="block text-volt">{m.home.heroTitleB}</span>
                </h1>
              </BlurFade>
              <BlurFade delay={0.2} duration={0.5}>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-background/70">{m.home.heroBody}</p>
              </BlurFade>
            </div>
            <BlurFade delay={0.3} duration={0.5} className="flex flex-col gap-3 sm:flex-row lg:w-60 lg:flex-col">
              <Link href="/products" transitionTypes={["nav-forward"]} className={buttonClasses("volt", "lg", "w-full")}>
                {m.home.heroCtaPrimary} <ArrowRight size={16} className="rtl:-scale-x-100" />
              </Link>
              <a
                href="#best"
                className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-background/25 px-6 text-[15px] font-semibold text-background transition-colors duration-150 hover:bg-background/10 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
              >
                {m.home.heroCtaSecondary}
              </a>
            </BlurFade>
          </div>

          {/* product stage */}
          <BlurFade delay={0.25} duration={0.6}>
            <div className="mt-10 overflow-hidden rounded-[24px] border border-background/12 bg-background/[0.04] md:mt-12">
              <div className="grid md:grid-cols-[1.35fr_1fr]">
                <div className="relative aspect-[16/11] md:aspect-auto md:min-h-[360px]">
                  <Image
                    src={hero.image}
                    alt={hero.name}
                    fill
                    priority
                    sizes="(min-width: 768px) 58vw, 92vw"
                    className="object-cover"
                  />
                  <span className="absolute top-4 start-4 rounded-full bg-foreground/85 px-3 py-1.5 font-mono text-[11px] font-bold text-volt backdrop-blur" dir="ltr">
                    {heroMsg.specs[0][1]}
                  </span>
                  <span className="absolute bottom-4 end-4 rounded-full bg-volt px-3 py-1.5 font-mono text-[11px] font-bold text-foreground" dir="ltr">
                    {heroMsg.specs[3][1]}
                  </span>
                </div>
                <div className="flex flex-col justify-center gap-4 border-t border-background/12 p-6 md:border-s md:border-t-0 md:p-8">
                  <div>
                    <Badge tone="volt">{m.categories[hero.category].name}</Badge>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight rtl:tracking-normal">{hero.name}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-background/70">{heroMsg.short}</p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <Star size={13} className="fill-volt text-volt" aria-hidden />
                    <span dir="ltr" className="font-semibold text-background">{hero.rating}</span>
                    <span dir="ltr" className="text-background/60">({hero.reviews})</span>
                  </div>
                  <div className="mt-1 font-mono text-[28px] font-bold leading-none text-volt" dir="ltr">
                    {price(variantPrice(hero, hero.variants[0].id))}
                  </div>
                  <Link
                    href={`/products/${hero.slug}`}
                    transitionTypes={["nav-forward"]}
                    className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-background/25 bg-background/5 px-5 text-sm font-semibold text-background transition-colors duration-150 hover:bg-background/12 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60"
                  >
                    {m.home.spotCta} <ArrowRight size={15} className="rtl:-scale-x-100" />
                  </Link>
                </div>
              </div>
            </div>
          </BlurFade>

          {/* stat strip */}
          <BlurFade delay={0.35} duration={0.5}>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-background/60">
              <span className="inline-flex items-center gap-1.5">
                <Star size={12} className="fill-volt text-volt" aria-hidden />
                {m.home.heroRating}
              </span>
              <span className="h-1 w-1 rounded-full bg-volt/60" aria-hidden />
              <span>{t("listing.resultsCount", { n: products.length })}</span>
              <span className="h-1 w-1 rounded-full bg-volt/60" aria-hidden />
              <span>{m.home.trust[0].title}</span>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ---------- Trust ---------- */}
      <section className="border-y border-line bg-surface/60" aria-label={m.home.whyTitle}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-5 gap-y-7 px-4 py-9 md:grid-cols-4 md:px-6 md:py-11">
          {m.home.trust.map((item, i) => {
            const Icon = trustIcons[i] ?? Truck;
            return (
              <BlurFade key={item.title} inView delay={i * 0.06}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-volt-soft text-accent-ink">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{item.body}</span>
                  </span>
                </div>
              </BlurFade>
            );
          })}
        </div>
      </section>

      {/* ---------- Best sellers ---------- */}
      <section id="best" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:px-6 md:py-24">
        <BlurFade inView>
          <SectionIntro
            eyebrow={t("common.bestSeller")}
            title={m.home.bestTitle}
            sub={m.home.bestSub}
            action={<ViewAll href="/products" />}
          />
        </BlurFade>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          {bestSellers.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} />
          ))}
        </div>
      </section>

      {/* ---------- Spotlight ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
        <BlurFade inView>
          <div className="relative overflow-hidden rounded-card bg-foreground text-background">
            <BorderBeam size={120} duration={9} colorFrom="#d4ec24" colorTo="#d4ec24" borderWidth={2} />
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{ background: "radial-gradient(600px circle at 85% 20%, rgba(212,236,36,0.28), transparent 65%)" }}
              aria-hidden
            />
            <div className="relative grid items-center gap-8 p-7 md:grid-cols-2 md:p-12">
              <div>
                <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-volt rtl:tracking-normal">
                  <span className="h-1.5 w-1.5 rounded-[2px] bg-volt" aria-hidden />
                  {m.home.spotEyebrow}
                </p>
                <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl rtl:tracking-normal">
                  {m.categories[spotlight.category].tagline}
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-background/70">{m.home.spotBody}</p>
                <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-sm font-semibold">{spotlight.name}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-background/70">
                    <Star size={12} className="fill-volt text-volt" aria-hidden />
                    <span dir="ltr">{spotlight.rating}</span>
                  </span>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/products/${spotlight.slug}`}
                    transitionTypes={["nav-forward"]}
                    className={buttonClasses("volt", "lg")}
                  >
                    {m.home.spotCta} <ArrowRight size={16} className="rtl:-scale-x-100" />
                  </Link>
                  <span className="font-mono text-sm text-background/80" dir="ltr">
                    {price(variantPrice(spotlight, spotlight.variants[0].id))}
                  </span>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-background/15">
                <div className="relative aspect-[4/3]">
                  <Image
                    src={spotlight.image}
                    alt={spotlight.name}
                    fill
                    sizes="(min-width: 768px) 45vw, 90vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </BlurFade>
      </section>

      {/* ---------- New arrivals ---------- */}
      <section className="border-t border-line bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <BlurFade inView>
            <SectionIntro
              eyebrow={t("common.new")}
              title={m.home.newTitle}
              sub={m.home.newSub}
              action={<ViewAll href="/products" />}
            />
          </BlurFade>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
            {newArrivals.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} morph={false} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Why hanutek ---------- */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <BlurFade inView>
            <h2 className="mb-10 text-balance text-2xl font-bold tracking-tight md:text-[30px] rtl:tracking-normal">
              {m.home.whyTitle}
            </h2>
          </BlurFade>
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {m.home.why.map((v, i) => (
              <BlurFade key={v.title} inView delay={i * 0.1}>
                <div className="border-t-2 border-volt pt-5">
                  <p className="font-mono text-xs text-accent-ink" dir="ltr">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-3 text-base font-semibold tracking-tight rtl:tracking-normal">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{v.body}</p>
                </div>
              </BlurFade>
            ))}
          </div>
          <BlurFade inView delay={0.2}>
            <div className="mt-12 flex justify-center">
              <Link
                href="/products"
                transitionTypes={["nav-forward"]}
                className={buttonClasses("primary", "lg", "relative z-0 overflow-hidden")}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {m.home.heroCtaPrimary} <ArrowRight size={16} className="rtl:-scale-x-100" />
                </span>
                <Shimmer color="#ffffff" background="var(--accent)" duration="3.2s" />
              </Link>
            </div>
          </BlurFade>
        </div>
      </section>
    </NavTransition>
  );
}
