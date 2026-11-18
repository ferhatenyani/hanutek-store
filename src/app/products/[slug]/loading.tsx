export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10" aria-busy="true">
      <div className="h-4 w-48 animate-pulse rounded bg-line/60" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="aspect-square animate-pulse rounded-card bg-line/40" />
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse rounded bg-line/60" />
          <div className="h-9 w-3/4 animate-pulse rounded-lg bg-line/60" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-line/50" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-line/60" />
          <div className="h-24 w-full animate-pulse rounded-card bg-line/40" />
          <div className="h-12 w-full animate-pulse rounded-full bg-line/50" />
        </div>
      </div>
    </div>
  );
}
