import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** URL-safe random token with `bytes` of entropy. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Tokens are stored as sha256 digests so a database leak does not leak live credentials. */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** HT-XXXXXX order reference (6 random digits; collisions retried by the caller). */
export const orderNumber = () => `HT-${randomInt(100000, 1000000)}`;
