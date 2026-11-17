import Link from "next/link";
import type { ReactNode } from "react";

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
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 md:py-20">
      <div className="rounded-card border border-line bg-surface p-7 shadow-card md:p-9">
        <Link href="/" className="mb-7 flex w-fit items-center gap-2.5" aria-label="hanutek">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-foreground font-sans text-lg font-bold text-background">
            h
          </span>
          <span className="text-lg font-semibold tracking-tight">hanutek</span>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </div>
      <p className="mt-6 text-center text-sm text-muted">{footer}</p>
    </div>
  );
}

export function MockNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 rounded-xl bg-accent-soft/60 px-4 py-3 text-center text-[11px] leading-relaxed text-faint">
      {children}
    </p>
  );
}
