export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-line/60" />
      <div className="mt-8 h-40 animate-pulse rounded-card bg-line/40" />
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="h-56 animate-pulse rounded-card bg-line/40" />
        <div className="h-56 animate-pulse rounded-card bg-line/40" />
      </div>
    </div>
  );
}
