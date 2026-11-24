import "server-only";
import { getDb } from "../db/client";
import { newsletterSubscribers } from "../db/schema";

/** Idempotent subscribe (re-subscribes a previously unsubscribed address). */
export async function subscribe(email: string, locale: "fr" | "ar") {
  const db = await getDb();
  await db
    .insert(newsletterSubscribers)
    .values({ email: email.trim().toLowerCase(), locale })
    .onConflictDoUpdate({ target: newsletterSubscribers.email, set: { unsubscribedAt: null, locale } });
}
