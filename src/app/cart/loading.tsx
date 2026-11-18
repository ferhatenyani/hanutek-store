export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14" aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded bg-line/60" />
      <div className="mt-6 h-10 w-64 animate-pulse rounded-lg bg-line/60" />
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-line/40" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-card bg-line/40" />
      </div>
    </div>
  );
}
