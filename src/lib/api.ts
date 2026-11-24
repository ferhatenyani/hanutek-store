/**
 * Browser API client for /api/v1.
 *  - same-origin, cookies only (httpOnly — JS never sees a token)
 *  - access token expiry → one shared refresh call → transparent retry
 *  - concurrent-tab refresh race → short retry
 *  - typed ApiError with server error code + field errors
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly reason?: string,
  ) {
    super(message);
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** internal: already retried after refresh */
  _retried?: boolean;
};

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh shared by every request that hit an expired token. */
export function refreshOnce(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" });
        if (res.ok) return true;
        if (res.status !== 409) return false; // 409 = another tab rotated first → its cookie is now ours
        await new Promise((r) => setTimeout(r, 150));
      }
      return false;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

/** Called when the session is definitively gone (store listens and signs the UI out). */
export const SESSION_LOST_EVENT = "hanutek:session-lost";

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", "Network error");
  }

  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

  let body: { error?: { code?: string; message?: string; fields?: Record<string, string>; reason?: string } } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  const code = body.error?.code ?? "HTTP_" + res.status;

  if (!opts._retried && (code === "AUTH_EXPIRED" || code === "REFRESH_RACE")) {
    if (await refreshOnce()) return api<T>(path, { ...opts, _retried: true });
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_LOST_EVENT));
  }
  throw new ApiError(res.status, code, body.error?.message ?? res.statusText, body.error?.fields, body.error?.reason);
}
