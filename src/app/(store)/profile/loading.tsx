export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14" aria-busy="true">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-line/60" />
      <div className="mt-8 h-64 animate-pulse rounded-card bg-line/40" />
    </div>
  );
}
