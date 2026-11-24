import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, type DbOrTx } from "../db/client";
import { refreshSessions, users } from "../db/schema";
import { env } from "../env";
import { randomToken, sha256 } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { log } from "../lib/logger";
import { signAccessToken } from "./tokens";
import type { Role } from "./rbac";

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
}

/** Grace window in which a just-rotated token gets REFRESH_RACE (concurrent tabs) instead of a family revoke. */
const RACE_GRACE_MS = 20_000;

type SessionUser = { id: string; role: Role; tokenVersion: number };

async function insertRefresh(db: DbOrTx, userId: string, familyId: string, meta: SessionMeta) {
  const raw = randomToken(32);
  await db.insert(refreshSessions).values({
    userId,
    familyId,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + env().REFRESH_TOKEN_TTL_DAYS * 86400_000),
    ip: meta.ip?.slice(0, 64),
    userAgent: meta.userAgent?.slice(0, 300),
  });
  return raw;
}

/** Starts a new login session (new refresh family). */
export async function issueSession(db: DbOrTx, user: SessionUser, meta: SessionMeta): Promise<IssuedTokens> {
  const familyId = randomUUID();
  const refreshToken = await insertRefresh(db, user.id, familyId, meta);
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, tv: user.tokenVersion, sid: familyId });
  return { accessToken, refreshToken, accessExpiresIn: env().ACCESS_TOKEN_TTL_SEC };
}

/**
 * Refresh-token rotation with reuse detection:
 *  - valid & unused token → rotated (old marked, new issued in the same family)
 *  - token already rotated within the grace window → REFRESH_RACE (another tab won; retry with the new cookie)
 *  - token rotated earlier / revoked → treated as theft: the whole family is revoked
 */
export async function rotateRefresh(raw: string, meta: SessionMeta): Promise<IssuedTokens & { userId: string }> {
  const db = await getDb();
  // Reuse must COMMIT the family revocation before failing, so the transaction
  // returns null in that case and the error is thrown after commit.
  let reused = false;
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: refreshSessions.id,
        userId: refreshSessions.userId,
        familyId: refreshSessions.familyId,
        expiresAt: refreshSessions.expiresAt,
        rotatedAt: refreshSessions.rotatedAt,
        revokedAt: refreshSessions.revokedAt,
      })
      .from(refreshSessions)
      .where(eq(refreshSessions.tokenHash, sha256(raw)))
      .for("update");

    if (!row) throw new AppError("UNAUTHENTICATED", "Session not found");
    if (row.revokedAt) throw new AppError("UNAUTHENTICATED", "Session revoked");
    if (row.expiresAt.getTime() <= Date.now()) throw new AppError("UNAUTHENTICATED", "Session expired");
    if (row.rotatedAt) {
      if (Date.now() - row.rotatedAt.getTime() < RACE_GRACE_MS) throw new AppError("REFRESH_RACE", "Session already refreshed");
      await tx
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshSessions.familyId, row.familyId), isNull(refreshSessions.revokedAt)));
      log.warn("refresh_token_reuse", { userId: row.userId, familyId: row.familyId, ip: meta.ip });
      reused = true;
      return null;
    }

    const [user] = await tx
      .select({ id: users.id, role: users.role, tokenVersion: users.tokenVersion, status: users.status })
      .from(users)
      .where(eq(users.id, row.userId));
    if (!user || user.status !== "active") throw new AppError("UNAUTHENTICATED", "Account unavailable");

    await tx.update(refreshSessions).set({ rotatedAt: new Date() }).where(eq(refreshSessions.id, row.id));
    const refreshToken = await insertRefresh(tx, user.id, row.familyId, meta);
    const accessToken = await signAccessToken({ sub: user.id, role: user.role, tv: user.tokenVersion, sid: row.familyId });
    return { accessToken, refreshToken, accessExpiresIn: env().ACCESS_TOKEN_TTL_SEC, userId: user.id };
  });
  if (reused || !result) throw new AppError("UNAUTHENTICATED", "Session revoked");
  return result;
}

export async function revokeFamily(familyId: string) {
  const db = await getDb();
  await db
    .update(refreshSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshSessions.familyId, familyId), isNull(refreshSessions.revokedAt)));
}

export async function revokeByRawToken(raw: string) {
  const db = await getDb();
  const [row] = await db.select({ familyId: refreshSessions.familyId }).from(refreshSessions).where(eq(refreshSessions.tokenHash, sha256(raw)));
  if (row) await revokeFamily(row.familyId);
}

/** Revoke every session and invalidate every access token of a user. */
export async function revokeAllForUser(db: DbOrTx, userId: string) {
  await db
    .update(refreshSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
  const [u] = await db.select({ tv: users.tokenVersion }).from(users).where(eq(users.id, userId));
  if (u) await db.update(users).set({ tokenVersion: u.tv + 1 }).where(eq(users.id, userId));
}
