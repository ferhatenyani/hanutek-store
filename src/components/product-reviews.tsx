"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ReviewListDTO } from "@/lib/api-types";
import { useStore } from "@/lib/store";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Rating } from "@/components/ui/rating";
import { Button, Spinner } from "@/components/ui/primitives";

/**
 * Product reviews: mounted only when its accordion section opens (lazy fetch).
 * Verified buyers (delivered order, no review yet) get a short form.
 */
export function ProductReviews({ slug }: { slug: string }) {
  const { m, t, date } = useI18n();
  const { user, ready } = useStore();
  const [data, setData] = useState<ReviewListDTO | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // reload when the viewer signs in/out (canReview depends on it) or on retry
  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    api<ReviewListDTO>(`/products/${encodeURIComponent(slug)}/reviews`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => (err as Error)?.name !== "AbortError" && setError(true));
    return () => ctrl.abort();
  }, [slug, ready, user?.id, attempt]);

  if (error) {
    return (
      <p className="text-sm text-muted">
        {m.common.loadFailed}{" "}
        <button
          type="button"
          onClick={() => {
            setError(false);
            setAttempt((n) => n + 1);
          }}
          className="cursor-pointer font-medium text-accent-ink underline underline-offset-2"
        >
          {m.common.retry}
        </button>
      </p>
    );
  }
  if (!data) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-line/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {data.count > 0 && (
        <div className="flex items-center gap-3">
          <span className="num font-display text-2xl font-semibold text-foreground">{data.rating.toFixed(1)}</span>
          <Rating value={data.rating} count={data.count} size={14} />
        </div>
      )}

      {data.canReview && <ReviewForm slug={slug} onDone={setData} />}

      {data.items.length === 0 ? (
        <p className="text-sm text-muted">{m.reviews.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.items.map((r) => (
            <li key={r.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Rating value={r.rating} size={12} />
                <span className="text-[13px] font-medium text-foreground">{r.author}</span>
                <span className="text-xs text-faint">{date(r.createdAt)}</span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-ink">{m.reviews.verified}</span>
              </div>
              {r.title && <p className="mt-2 text-sm font-semibold text-foreground">{r.title}</p>}
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
      {!user && ready && <p className="text-xs text-faint">{t("reviews.signInHint")}</p>}
    </div>
  );
}

function ReviewForm({ slug, onDone }: { slug: string; onDone: (d: ReviewListDTO) => void }) {
  const { m } = useI18n();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return setError(m.reviews.errRating);
    if (body.trim().length < 10) return setError(m.reviews.errBody);
    setBusy(true);
    setError("");
    try {
      onDone(await api<ReviewListDTO>(`/products/${encodeURIComponent(slug)}/reviews`, { method: "POST", body: { rating, title: title || null, body } }));
    } catch (err) {
      setError(err instanceof ApiError && err.code === "RATE_LIMITED" ? m.common.tooMany : m.common.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-card border border-line bg-surface p-4" noValidate>
      <p className="text-sm font-semibold text-foreground">{m.reviews.writeTitle}</p>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label={m.reviews.ratingLabel}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}/5`}
            onClick={() => setRating(n)}
            className="cursor-pointer p-0.5"
          >
            <Star size={22} className={cn("transition-colors", n <= rating ? "fill-foreground text-foreground" : "text-line")} />
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder={m.reviews.titlePlaceholder}
        aria-label={m.reviews.titlePlaceholder}
        className="mt-3 h-11 w-full rounded-control border border-line bg-background px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder={m.reviews.bodyPlaceholder}
        aria-label={m.reviews.bodyPlaceholder}
        className="mt-2 w-full rounded-control border border-line bg-background px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
      />
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <Button type="submit" className="mt-3 gap-2" disabled={busy}>
        {busy && <Spinner />} {m.reviews.submit}
      </Button>
    </form>
  );
}
