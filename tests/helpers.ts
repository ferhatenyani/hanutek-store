import { createDb, setDb, type Db } from "@/server/db/client";
import { seed } from "@/server/db/seed/seed";
import { resetEnvCache } from "@/server/env";

export const ADMIN = { email: "admin@test.dz", password: "AdminPass!123" };

/** Fresh in-memory Postgres (PGlite), migrated and seeded, injected as the app database. */
export async function freshDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  resetEnvCache();
  const { db, migrate, close } = createDb("pglite:memory");
  await migrate();
  await seed(db, { adminEmail: ADMIN.email, adminPassword: ADMIN.password });
  setDb(db);
  return { db, close };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx?: { params?: Promise<any> }) => Promise<Response>;

interface StoredCookie {
  value: string;
  path: string;
}

export interface CallOptions {
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  /** Raw body (e.g. FormData / malformed JSON) — bypasses JSON encoding. */
  raw?: BodyInit;
  query?: Record<string, string>;
}

/**
 * A browser-like API client: keeps a cookie jar honoring Path / Max-Age,
 * sends a same-origin Origin header by default, and invokes Next.js route
 * handlers directly (no server needed).
 */
export class Client {
  jar = new Map<string, StoredCookie>();
  constructor(public origin: string | null = "http://localhost:3000") {}

  cookie(name: string) {
    return this.jar.get(name)?.value;
  }

  private cookieHeader(path: string) {
    return [...this.jar.entries()]
      .filter(([, c]) => path === c.path || path.startsWith(c.path.endsWith("/") ? c.path : `${c.path}/`) || c.path === "/")
      .map(([k, c]) => `${k}=${encodeURIComponent(c.value)}`)
      .join("; ");
  }

  private absorb(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = decodeURIComponent(pair.slice(i + 1));
      const path = attrs.find((a) => a.toLowerCase().startsWith("path="))?.slice(5) ?? "/";
      const maxAge = attrs.find((a) => a.toLowerCase().startsWith("max-age="));
      if (maxAge && Number(maxAge.slice(8)) <= 0) this.jar.delete(name);
      else this.jar.set(name, { value, path });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async call<T = any>(handler: Handler, method: string, path: string, opts: CallOptions = {}) {
    const headers = new Headers(opts.headers);
    if (this.origin && !headers.has("origin")) headers.set("origin", this.origin);
    const cookie = this.cookieHeader(path);
    if (cookie) headers.set("cookie", cookie);
    let body: BodyInit | undefined = opts.raw;
    if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers.set("content-type", "application/json");
    }
    const qs = opts.query ? `?${new URLSearchParams(opts.query)}` : "";
    const req = new Request(`http://localhost:3000${path}${qs}`, { method, headers, body });
    const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    this.absorb(res);
    const text = await res.text();
    let data: T = null as T;
    try {
      data = text ? JSON.parse(text) : (null as T);
    } catch {
      /* non-JSON (redirects) */
    }
    return { status: res.status, data, res };
  }
}

export const uuid = () => crypto.randomUUID();

export const checkoutBody = (over: Record<string, unknown> = {}) => ({
  idempotencyKey: uuid(),
  contact: { name: "Yacine Benali", phone: "0550 12 34 56", email: "yacine@example.dz" },
  address: { line1: "12 Rue Didouche Mourad", commune: "Alger Centre", wilaya: "16", postalCode: "16000" },
  locale: "fr",
  ...over,
});
