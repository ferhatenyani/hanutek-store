import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z, type ZodType } from "zod";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { env } from "../env";
import { COOKIE, clearAuthCookies } from "../auth/cookies";
import { verifyAccessToken } from "../auth/tokens";
import { can, type Permission, type Role } from "../auth/rbac";
import { AppError } from "./errors";
import { log } from "./logger";
import { enforce, type Limit } from "./rate-limit";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  sessionFamily: string;
  via: "cookie" | "bearer";
}

export interface Ctx<P = Record<string, string>> {
  req: Request;
  url: URL;
  params: P;
  ip: string;
  userAgent: string;
  requestId: string;
  /** Resolved identity (null = anonymous). */
  user: AuthUser | null;
  /** Read a cookie from the request. */
  cookie(name: string): string | undefined;
  /** Queue a Set-Cookie header on the response. */
  setCookie(serialized: string): void;
  /** Parse + validate the JSON body (size-capped). */
  body<T>(schema: ZodType<T>): Promise<T>;
  /** Parse + validate the query string. */
  query<T>(schema: ZodType<T>): T;
  /** The authenticated user or UNAUTHENTICATED. */
  requireUser(): AuthUser;
}

type AuthMode = "none" | "optional" | "required" | { permission: Permission };

export interface RouteOptions {
  auth?: AuthMode;
  /** Rate-limit buckets: subject defaults to client IP (or user id when `perUser`). */
  limits?: { limit: Limit; perUser?: boolean }[];
  /** Max JSON body size in bytes. */
  maxBody?: number;
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function parseCookies(header: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try {
      map.set(k, decodeURIComponent(v));
    } catch {
      map.set(k, v);
    }
  }
  return map;
}

/** Client IP honoring only the configured number of trusted proxy hops. */
export function clientIp(req: Request): string {
  const hops = env().TRUST_PROXY_HOPS;
  if (hops > 0) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const chain = xff.split(",").map((s) => s.trim()).filter(Boolean);
      const candidate = chain[Math.max(0, chain.length - hops)];
      if (candidate) return candidate;
    }
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "local";
}

export function allowedOrigins(req: Request): Set<string> {
  const set = new Set<string>([new URL(env().APP_URL).origin, new URL(req.url).origin]);
  for (const o of env().ADMIN_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)) set.add(o);
  return set;
}

/**
 * CSRF defence for cookie-authenticated, state-changing requests:
 * SameSite cookies + a strict Origin (or Sec-Fetch-Site) check. Bearer-token
 * requests carry no ambient credentials and are exempt.
 */
function checkCsrf(req: Request, usesBearer: boolean) {
  if (!UNSAFE.has(req.method) || usesBearer) return;
  // No cookies → no ambient credentials to abuse (server-to-server / bearer clients).
  if (!req.headers.get("cookie")) return;
  const origin = req.headers.get("origin");
  if (origin) {
    if (!allowedOrigins(req).has(origin)) throw new AppError("CSRF", "Cross-site request rejected");
    return;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return;
  throw new AppError("CSRF", "Missing Origin header");
}

export async function resolveUser(req: Request, cookies: Map<string, string>, mode: AuthMode): Promise<AuthUser | null> {
  const authz = req.headers.get("authorization");
  const bearer = authz?.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : null;
  const token = bearer ?? cookies.get(COOKIE.access);
  if (!token || mode === "none") return null;

  const res = await verifyAccessToken(token);
  if (!res.ok) {
    // An expired token must not silently downgrade to "guest" (e.g. cart
    // would switch to the guest cart): tell the client to refresh.
    if (res.reason === "expired") throw new AppError("AUTH_EXPIRED", "Access token expired");
    if (mode === "optional") return null;
    throw new AppError("UNAUTHENTICATED", "Invalid access token");
  }

  const db = await getDb();
  const [u] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      tokenVersion: users.tokenVersion,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, res.claims.sub));
  if (!u || u.status !== "active" || u.tokenVersion !== res.claims.tv) {
    if (mode === "optional") return null;
    throw new AppError("UNAUTHENTICATED", "Session is no longer valid");
  }
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    emailVerified: Boolean(u.emailVerifiedAt),
    sessionFamily: res.claims.sid,
    via: bearer ? "bearer" : "cookie",
  };
}

export function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function errorResponse(err: AppError, requestId: string): Response {
  const headers: Record<string, string> = { "x-request-id": requestId };
  if (err.details?.retryAfter) headers["retry-after"] = String(err.details.retryAfter);
  return json(
    {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details?.fields ? { fields: err.details.fields } : {}),
        ...(typeof err.details?.reason === "string" ? { reason: err.details.reason } : {}),
        ...(Array.isArray(err.details?.lines) ? { lines: err.details.lines } : {}),
      },
    },
    { status: err.status, headers },
  );
}

function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError("VALIDATION", "Invalid input", { fields: zodFields(r.error) });
  return r.data;
}

type Handler<P> = (ctx: Ctx<P>) => Promise<Response | unknown>;

/**
 * Wraps a route handler with: request id, auth resolution + RBAC, CSRF,
 * rate limits, JSON body limits/validation, error mapping and access logs.
 */
export function route<P extends Record<string, string> = Record<string, string>>(opts: RouteOptions, handler: Handler<P>) {
  return async (req: Request, context?: { params?: Promise<P> }): Promise<Response> => {
    const started = performance.now();
    const requestId = req.headers.get("x-request-id")?.slice(0, 64) || randomUUID();
    const url = new URL(req.url);
    const cookies = parseCookies(req.headers.get("cookie"));
    const outCookies: string[] = [];
    const ip = clientIp(req);
    let user: AuthUser | null = null;
    let status = 500;
    try {
      const mode = opts.auth ?? "optional";
      const usesBearer = Boolean(req.headers.get("authorization"));
      checkCsrf(req, usesBearer && !cookies.has(COOKIE.access));
      user = await resolveUser(req, cookies, mode);
      if (mode === "required" && !user) throw new AppError("UNAUTHENTICATED", "Sign in required");
      if (typeof mode === "object") {
        if (!user) throw new AppError("UNAUTHENTICATED", "Sign in required");
        if (!can(user.role, mode.permission)) throw new AppError("FORBIDDEN", "Insufficient permissions");
      }
      for (const { limit, perUser } of opts.limits ?? []) {
        await enforce(limit, perUser && user ? `u:${user.id}` : `ip:${ip}`);
      }

      const params = ((await context?.params) ?? {}) as P;
      const maxBody = opts.maxBody ?? 64 * 1024;
      const ctx: Ctx<P> = {
        req,
        url,
        params,
        ip,
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? "",
        requestId,
        user,
        cookie: (name) => cookies.get(name),
        setCookie: (c) => void outCookies.push(c),
        async body(schema) {
          const ct = req.headers.get("content-type") ?? "";
          if (!ct.includes("application/json")) throw new AppError("UNSUPPORTED_MEDIA", "Expected application/json");
          const len = Number(req.headers.get("content-length") ?? 0);
          if (len > maxBody) throw new AppError("PAYLOAD_TOO_LARGE", "Request body too large");
          const text = await req.text();
          if (text.length > maxBody) throw new AppError("PAYLOAD_TOO_LARGE", "Request body too large");
          let data: unknown;
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            throw new AppError("BAD_REQUEST", "Malformed JSON");
          }
          return validate(schema, data);
        },
        query(schema) {
          return validate(schema, Object.fromEntries(url.searchParams));
        },
        requireUser() {
          if (!user) throw new AppError("UNAUTHENTICATED", "Sign in required");
          return user;
        },
      };

      const result = await handler(ctx);
      const res = result instanceof Response ? result : json(result ?? { ok: true });
      for (const c of outCookies) res.headers.append("set-cookie", c);
      res.headers.set("x-request-id", requestId);
      status = res.status;
      return res;
    } catch (err) {
      if (err instanceof AppError) {
        status = err.status;
        const res = errorResponse(err, requestId);
        // A token that can't be verified (not merely expired) gets cleared.
        if (err.code === "UNAUTHENTICATED" && cookies.has(COOKIE.access)) {
          for (const c of clearAuthCookies().slice(0, 1)) res.headers.append("set-cookie", c);
        }
        for (const c of outCookies) res.headers.append("set-cookie", c);
        return res;
      }
      log.error("unhandled_error", { requestId, method: req.method, path: url.pathname, err });
      return errorResponse(new AppError("INTERNAL", "Something went wrong"), requestId);
    } finally {
      log.info("request", {
        requestId,
        method: req.method,
        path: url.pathname,
        status,
        ms: Math.round(performance.now() - started),
        userId: user?.id,
      });
    }
  };
}

