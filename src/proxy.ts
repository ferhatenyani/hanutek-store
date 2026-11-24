import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS for the API. The storefront is same-origin and needs no CORS; only
 * origins listed in ADMIN_ORIGINS (the future admin app) may call /api/v1
 * cross-origin, and only with Bearer tokens — credentials (cookies) are never
 * allowed cross-origin.
 */
const allowed = new Set(
  (process.env.ADMIN_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-request-id",
  "Access-Control-Max-Age": "600",
};

export function proxy(req: NextRequest) {
  const origin = req.headers.get("origin");
  const isAllowed = origin !== null && allowed.has(origin);

  if (req.method === "OPTIONS") {
    if (!isAllowed) return new NextResponse(null, { status: 403 });
    return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin!, Vary: "Origin" } });
  }

  const res = NextResponse.next();
  if (isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin!);
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export const config = { matcher: "/api/:path*" };
