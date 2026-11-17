"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClasses } from "@/components/ui/primitives";
import { useI18n } from "@/i18n/provider";

export default function NotFound() {
  const { m } = useI18n();
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-28 text-center md:px-6">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-surface text-muted">
        <Compass size={26} aria-hidden />
      </span>
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-faint uppercase">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{m.notFound.title}</h1>
        <p className="mt-2 text-sm text-muted">{m.notFound.body}</p>
      </div>
      <Link href="/" className={buttonClasses("dark", "lg")}>
        {m.notFound.cta}
      </Link>
    </div>
  );
}
