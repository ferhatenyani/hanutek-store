import Link from "next/link";
import type { ReactNode } from "react";
import { NavTransition } from "@/components/nav-transition";
import { BlurFade } from "@/components/ui/blur-fade";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <NavTransition>
      <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 md:py-20">
        <BlurFade duration={0.45}>
          <div className="rounded-card border border-line bg-background p-7 shadow-sm md:p-9">
            <Link href="/" transitionTypes={["nav-back"]} className="mb-7 flex items-center gap-2.5" aria-label="Hanutek home">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-foreground font-sans text-lg font-bold text-background">
                h
              </span>
              <span className="text-lg font-semibold tracking-tight">hanutek</span>
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </BlurFade>
        <BlurFade delay={0.15} duration={0.4}>
          <p className="mt-6 text-center text-sm text-muted">{footer}</p>
        </BlurFade>
      </div>
    </NavTransition>
  );
}

export function MockNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 rounded-xl bg-surface px-4 py-3 text-center text-[11px] leading-relaxed text-faint">
      {children}
    </p>
  );
}