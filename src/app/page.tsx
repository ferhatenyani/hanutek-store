import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Lock, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { categories, products, productsInCategory, variantPrice } from "@/lib/products";
import { formatPrice } from "@/lib/utils";
import { buttonClasses, SectionHead, Badge } from "@/components/ui/primitives";
import { BlurFade } from "@/components/ui/blur-fade";
import { TextAnimate } from "@/components/ui/text-animate";
import { Marquee } from "@/components/ui/marquee";
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

const trust = [
  { icon: Truck, label: "Free shipping over €50" },
  { icon: ShieldCheck, label: "2-year warranty" },
  { icon: RotateCcw, label: "30-day returns" },
  { icon: Lock, label: "Secure checkout" },
  { icon: PackageCheck, label: "Ships within 24 h" },
];

export default function HomePage() {
  return (
    <NavTransition>
      {/* ---------- Hero ---------- */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-12 md:grid-cols-[1.05fr_1fr] md:gap-14 md:px-6 md:pt-16 md:pb-20">
        <div>
          <BlurFade duration={0.5}>
            <p className="mb-5 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.2em] text-accent-ink uppercase">
              <span className="h-2 w-2 rounded-[2px] bg-volt" aria-hidden />
              Automotive gear, considered
            </p>
          </BlurFade>
          <TextAnimate
            as="h1"
            by="word"
            animation="blurInUp"
            duration={0.5}
            className="text-[42px] leading-[1.02] font-bold tracking-[-0.03em] text-balance md:text-[62px]"
          >
            Gear that earns its place in your car.
          </TextAnimate>
          <BlurFade delay={0.25} duration={0.5}>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Dash cams, jump starters, mounts and detailing tools — picked for build quality, tested on real roads, and
              nothing you don&apos;t need.
            </p>
          </BlurFade>
          <BlurFade delay={0.35} duration={0.5}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/products"
                transitionTypes={["nav-forward"]}
                className={buttonClasses("primary", "lg", "relative z-0 w-full overflow-hidden sm:w-auto")}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Shop all products <ArrowRight size={16} />
                </span>
                <Shimmer color="#ffffff" background="var(--accent)" duration="3.2s" />
              </Link>
              <a href="#categories" className={buttonClasses("outline", "lg", "w-full sm:w-auto")}>
                Browse categories
              </a>
            </div>
          </BlurFade>
          <BlurFade delay={0.45} duration={0.5}>
            <div className="mt-9 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[10px] tracking-wide text-faint">
              <span>{products.length} road-tested products</span>
              <span>{categories.length} categories</span>
              <span>2-year warranty</span>
            </div>
          </BlurFade>
        </div>

        <BlurFade delay={0.2} duration={0.6} className="relative">
          <div className="relative overflow-hidden rounded-[22px] bg-volt p-3.5 md:p-7">
            <div className="relative overflow-hidden rounded-xl">
              <div className="relative aspect-[4/3]">
                <Image
                  src={hero.image}
                  alt={hero.name}
                  fill
                  priority
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="absolute top-3 left-3">
                <Badge tone="dark">Featured</Badge>
              </div>
            </div>
            <Link
              href={`/products/${hero.slug}`}
              transitionTypes={["nav-forward"]}
              className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-accent px-4 py-3 text-background transition-transform duration-300 hover:-translate-y-0.5"
            >
              <span>
                <span className="block text-sm font-medium">{hero.name}</span>
                <span className="mt-0.5 block font-mono text-xs text-background/70">
                  from {formatPrice(variantPrice(hero, hero.variants[0].id))}
                </span>
              </span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-volt text-accent">
                <ArrowUpRight size={15} />
              </span>
            </Link>
            <p className="mt-3 text-center font-mono text-[10px] tracking-[0.22em] text-accent/70 uppercase">
              Road-tested · 2-year warranty
            </p>
          </div>
        </BlurFade>
      </section>

      {/* ---------- Trust marquee ---------- */}
      <section className="bg-volt py-1" aria-label="Store promises">
        <Marquee
          pauseOnHover
          className="[--duration:36s] [--gap:3rem] [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
        >
          {trust.map((t) => (
            <span key={t.label} className="flex items-center gap-2.5 px-2 text-sm font-medium text-accent">
              <t.icon size={16} />
              {t.label}
            </span>
          ))}
        </Marquee>
      </section>

      {/* ---------- Categories ---------- */}
      <section id="categories" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <BlurFade inView>
          <SectionHead eyebrow="Browse" title="Shop by category" />
        </BlurFade>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {categories.map((c, i) => (
            <BlurFade key={c.slug} inView delay={i * 0.08}>
              <Link
                href={`/products?category=${c.slug}`}
                transitionTypes={["nav-forward"]}
                className="group block overflow-hidden rounded-card border border-line bg-background transition-colors duration-300 hover:border-foreground/25"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                  <Image
                    src={c.image}
                    alt={c.name}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{c.name}</h3>
                    <ArrowUpRight
                      size={15}
                      className="shrink-0 text-faint transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-ink"
                    />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{c.tagline}</p>
                  <p className="mt-2 font-mono text-[10px] text-faint">{productsInCategory(c.slug).length} products</p>
                </div>
              </Link>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ---------- Best sellers ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
        <BlurFade inView>
          <SectionHead
            eyebrow="Curated"
            title="Best sellers"
            action={
              <Link
                href="/products"
                transitionTypes={["nav-forward"]}
                className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent-ink transition-colors hover:text-accent"
              >
                View all <ArrowRight size={14} />
              </Link>
            }
          />
        </BlurFade>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-5">
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
            <div className="relative grid items-center gap-8 p-8 md:grid-cols-2 md:p-12">
              <div>
                <p className="mb-3 font-mono text-[11px] tracking-[0.2em] text-volt uppercase">
                  Spotlight · Power & Diagnostics
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
                  Never get stranded again.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-background/70">
                  {spotlight.short} {spotlight.description.split(". ")[1] ?? ""}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/products/${spotlight.slug}`}
                    transitionTypes={["nav-forward"]}
                    className={buttonClasses("volt", "lg")}
                  >
                    Shop {spotlight.name.split(" ")[0]} <ArrowRight size={16} />
                  </Link>
                  <span className="font-mono text-sm text-background/70">
                    from {formatPrice(variantPrice(spotlight, spotlight.variants[0].id))}
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
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
        <BlurFade inView>
          <SectionHead
            eyebrow="Just landed"
            title="New arrivals"
            action={
              <Link
                href="/products"
                transitionTypes={["nav-forward"]}
                className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent-ink transition-colors hover:text-accent"
              >
                View all <ArrowRight size={14} />
              </Link>
            }
          />
        </BlurFade>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-5">
          {newArrivals.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} morph={false} />
          ))}
        </div>
      </section>

      {/* ---------- Why hanutek ---------- */}
      <section className="border-t border-line bg-surface/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-3 md:px-6 md:py-20">
          {[
            {
              n: "01",
              title: "Road-tested, not shelf-tested",
              copy: "Every product spends a week in a real car before it earns a spot in the catalog. If it rattles, it's out.",
            },
            {
              n: "02",
              title: "Fit-first thinking",
              copy: "Variants for sockets, sizes and kits — so what arrives is what fits your car, not a compromise.",
            },
            {
              n: "03",
              title: "Built to outlast the lease",
              copy: "Two-year warranty on everything, 30-day returns, and spare parts that stay available.",
            },
          ].map((v, i) => (
            <BlurFade key={v.n} inView delay={i * 0.1}>
              <p className="font-mono text-xs text-accent-ink">{v.n}</p>
              <h3 className="mt-3 text-base font-semibold tracking-tight">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{v.copy}</p>
            </BlurFade>
          ))}
        </div>
      </section>
    </NavTransition>
  );
}