import "server-only";
import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env";
import { randomToken } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { sameSitePath } from "@/lib/utils";

/**
 * Google sign-in — OpenID Connect authorization-code flow with PKCE (S256),
 * a nonce bound to the ID token, and a signed state cookie. The ID token is
 * verified against Google's JWKS (signature, iss, aud, exp, nonce).
 */
const GOOGLE = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  certs: "https://www.googleapis.com/oauth2/v3/certs",
  issuers: ["https://accounts.google.com", "accounts.google.com"],
};

/** Provider endpoints; GOOGLE_OIDC_BASE swaps in a local stand-in for E2E (refused in real production by env()). */
function provider() {
  const base = env().GOOGLE_OIDC_BASE?.replace(/\/$/, "");
  if (!base) return GOOGLE;
  return { auth: `${base}/o/oauth2/v2/auth`, token: `${base}/token`, certs: `${base}/certs`, issuers: [base] };
}

let jwks: { url: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null;
function keySet() {
  const url = provider().certs;
  if (jwks?.url !== url) jwks = { url, set: createRemoteJWKSet(new URL(url)) };
  return jwks.set;
}

export const redirectUri = () => `${env().APP_URL}/api/v1/auth/google/callback`;

export function buildAuthorization() {
  const state = randomToken(24);
  const nonce = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(provider().auth);
  url.search = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, nonce, verifier };
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

export async function exchangeCode(code: string, verifier: string, nonce: string): Promise<GoogleProfile> {
  const res = await fetch(provider().token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env().GOOGLE_CLIENT_ID!,
      client_secret: env().GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new AppError("UNAUTHENTICATED", "Google sign-in failed");
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new AppError("UNAUTHENTICATED", "Google sign-in failed");

  const { payload } = await jwtVerify(data.id_token, keySet(), {
    issuer: provider().issuers,
    audience: env().GOOGLE_CLIENT_ID!,
  }).catch(() => {
    throw new AppError("UNAUTHENTICATED", "Google identity could not be verified");
  });
  if (payload.nonce !== nonce) throw new AppError("UNAUTHENTICATED", "Google identity could not be verified");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new AppError("UNAUTHENTICATED", "Your Google email address is not verified");
  }
  return { sub: payload.sub, email: payload.email, name: typeof payload.name === "string" ? payload.name : "" };
}

/** Only same-site relative paths are accepted as post-login redirects (no open redirect). */
export function safeNext(next: string | null | undefined, fallback = "/profile"): string {
  return sameSitePath(next) ?? fallback;
}
