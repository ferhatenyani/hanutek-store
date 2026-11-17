"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Home hero — auto-playing brand film inside a rounded banner card
 * (mobileRef banner concept, no CTAs, no nav dots).
 * One source per screen family: phone 2:1 · tablet 2:1 · desktop 16:9,
 * WebM first with an H.264 MP4 fallback. Poster + static image under
 * prefers-reduced-motion.
 */
export function HeroVideo() {
  const { m } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduceMotion) v.pause();
    else void v.play().catch(() => undefined);
  }, [reduceMotion]);

  return (
    <section aria-label={m.home.heroEyebrow} className="mx-auto w-full max-w-6xl px-4 pt-4 lg:px-6 lg:pt-6">
      <div className="relative aspect-[2/1] overflow-hidden rounded-[24px] bg-foreground lg:aspect-[16/9]">
        {reduceMotion ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/hero/web/hero-desktop.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            poster="/hero/web/hero-tablet.jpg"
          >
            <source media="(min-width: 64rem)" src="/hero/web/hero-desktop.mp4" type="video/mp4" />
            <source media="(min-width: 64rem)" src="/hero/web/hero-desktop.webm" type="video/webm" />
            <source media="(min-width: 48rem)" src="/hero/web/hero-tablet.mp4" type="video/mp4" />
            <source media="(min-width: 48rem)" src="/hero/web/hero-tablet.webm" type="video/webm" />
            <source src="/hero/web/hero-mobile.mp4" type="video/mp4" />
            <source src="/hero/web/hero-mobile.webm" type="video/webm" />
          </video>
        )}

        {/* legibility scrim: dark from the text side, clear over the film */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/25 to-transparent lg:bg-gradient-to-r lg:from-foreground/85 lg:via-foreground/25 lg:to-transparent"
        />

        {/* copy block — bottom-left on phones/tablets, left-centered on desktop */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:inset-y-0 lg:flex lg:max-w-[55%] lg:items-center lg:p-12">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-volt/40 bg-foreground/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-volt backdrop-blur-sm rtl:tracking-normal sm:text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-volt" aria-hidden />
              {m.home.heroEyebrow}
            </p>
            <h1 className="text-balance text-[20px] font-bold leading-[1.08] tracking-tight text-white sm:text-3xl lg:text-5xl rtl:tracking-normal">
              {m.home.heroTitleA}
              <span className="block text-volt">{m.home.heroTitleB}</span>
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}
