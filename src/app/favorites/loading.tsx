export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14" aria-busy="true">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-line/60" />
      <div className="product-grid mt-7 md:mt-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-card bg-line/40" />
        ))}
      </div>
    </div>
  );
}
