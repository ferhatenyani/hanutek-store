import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="grid place-items-center px-6 py-24 text-center">
      <div>
        <p className="font-[family-name:var(--font-admin-mono)] text-xs text-ad-faint">404</p>
        <h1 className="mt-2 text-base font-semibold">This page doesn&apos;t exist</h1>
        <Link href="/admin" className="mt-4 inline-block text-[13px] text-ad-muted underline underline-offset-2 hover:text-ad-fg">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
