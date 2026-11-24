import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at first use. Never import this from
 * client code (server-only guards it). Secrets stay on the server.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Postgres URL, or `pglite:<dir>` / `pglite:memory` for the embedded engine. */
  DATABASE_URL: z.string().min(1).default("pglite:./.data/pglite"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  /** HS256 signing secret for access tokens — at least 32 random bytes. */
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  /** Extra origins allowed to call the API with credentials (future admin app). Comma separated. */
  ADMIN_ORIGINS: z.string().default(""),
  /** Number of trusted reverse-proxy hops in front of the app (0 = do not trust X-Forwarded-For). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  MAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
  MAIL_FROM: z.string().default("hanutek <no-reply@hanutek.dz>"),
  RESEND_API_KEY: z.string().optional(),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Absolute directory for STORAGE_DRIVER=local uploads (production: a persistent path served by nginx at /uploads). */
  UPLOAD_DIR: z.string().optional(),
  /** Public base URL the stored media is served from (CDN), e.g. https://cdn.hanutek.dz */
  MEDIA_PUBLIC_URL: z.string().url().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  // Empty values (e.g. `S3_ENDPOINT=` copied from .env.example) count as unset.
  const defined = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = schema.safeParse({
    ...defined,
    // Dev/test convenience: a fixed secret is acceptable only outside production.
    JWT_SECRET:
      // `||` (not `??`): an empty JWT_SECRET= copied from .env.example must still fall back in dev
      process.env.JWT_SECRET ||
      (process.env.NODE_ENV !== "production" ? "dev-only-insecure-secret-change-me-0123456789" : undefined),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment — ${issues}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === "production") {
    // LOCAL_PREVIEW=1 allows `next build && next start` on a laptop (embedded DB, http). Never set it on a server.
    const preview = process.env.LOCAL_PREVIEW === "1";
    if (!preview && e.DATABASE_URL.startsWith("pglite:")) throw new Error("DATABASE_URL must point to PostgreSQL in production");
    if (!preview && !e.APP_URL.startsWith("https://")) throw new Error("APP_URL must be https in production");
    if (e.MAIL_DRIVER === "resend" && !e.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required");
    if (e.STORAGE_DRIVER === "s3" && !(e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY && e.MEDIA_PUBLIC_URL)) {
      throw new Error("S3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, MEDIA_PUBLIC_URL");
    }
  }
  cached = e;
  return e;
}

export const isProd = () => env().NODE_ENV === "production";
export const googleEnabled = () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);

/** Test hook: drop the memoized env after mutating process.env. */
export function resetEnvCache() {
  cached = null;
}
