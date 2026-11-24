import "server-only";
import { SignJWT, jwtVerify, errors } from "jose";
import { env } from "../env";
import type { Role } from "./rbac";

const ISSUER = "hanutek";
const AUDIENCE = "hanutek-api";

export interface AccessClaims {
  sub: string;
  role: Role;
  /** user.tokenVersion at issue time */
  tv: number;
  /** refresh-session family id (lets logout revoke the matching refresh chain) */
  sid: string;
}

const key = () => new TextEncoder().encode(env().JWT_SECRET);

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, tv: claims.tv, sid: claims.sid })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env().ACCESS_TOKEN_TTL_SEC}s`)
    .sign(key());
}

export type VerifyResult = { ok: true; claims: AccessClaims } | { ok: false; reason: "expired" | "invalid" };

export async function verifyAccessToken(token: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.tv !== "number" || typeof payload.sid !== "string") {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, claims: { sub: payload.sub, role: payload.role as Role, tv: payload.tv, sid: payload.sid } };
  } catch (e) {
    return { ok: false, reason: e instanceof errors.JWTExpired ? "expired" : "invalid" };
  }
}

/** Short-lived signed blob for OAuth state (state + PKCE verifier + nonce + next). */
export async function signState(data: Record<string, string>, ttlSec = 600): Promise<string> {
  return new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience("hanutek-oauth-state")
    .setExpirationTime(`${ttlSec}s`)
    .sign(key());
}

export async function verifyState(token: string): Promise<Record<string, string> | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, audience: "hanutek-oauth-state", algorithms: ["HS256"] });
    return payload as Record<string, string>;
  } catch {
    return null;
  }
}
