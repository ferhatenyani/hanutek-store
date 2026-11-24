import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb, type DbOrTx } from "../db/client";
import { addresses, users, verificationTokens } from "../db/schema";
import { env } from "../env";
import { hashPassword, verifyPassword } from "../auth/password";
import { issueSession, revokeAllForUser, type IssuedTokens, type SessionMeta } from "../auth/session";
import { randomToken, sha256 } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { log } from "../lib/logger";
import { resetMail, sendMail, verificationMail } from "./mail";
import type { AddressDTO, Locale, UserDTO } from "@/lib/api-types";

export const MAX_FAILED_LOGINS = 10;
export const LOCK_MINUTES = 15;
const VERIFY_TTL_MS = 24 * 3600_000;
const RESET_TTL_MS = 30 * 60_000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

type UserRow = typeof users.$inferSelect;

export async function toUserDTO(d: DbOrTx, u: UserRow): Promise<UserDTO> {
  const [addr] = await d
    .select()
    .from(addresses)
    .where(and(eq(addresses.userId, u.id), eq(addresses.isDefault, true)))
    .limit(1);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: Boolean(u.emailVerifiedAt),
    phone: u.phone,
    role: u.role,
    hasPassword: Boolean(u.passwordHash),
    googleLinked: Boolean(u.googleSub),
    defaultAddress: addr
      ? { id: addr.id, fullName: addr.fullName, phone: addr.phone, line1: addr.line1, commune: addr.commune, wilaya: addr.wilaya, postalCode: addr.postalCode }
      : null,
  };
}

export async function getUserDTO(userId: string): Promise<UserDTO | null> {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  return u ? toUserDTO(db, u) : null;
}

// ------------------------------------------------------------ one-time tokens

async function createOneTimeToken(d: DbOrTx, userId: string, type: "email_verify" | "password_reset", ttlMs: number) {
  // Only the newest token of a type stays valid.
  await d
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.type, type), isNull(verificationTokens.usedAt)));
  const raw = randomToken(32);
  await d.insert(verificationTokens).values({ userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

/** Atomically consumes a token; returns the user id or throws TOKEN_INVALID. */
async function consumeToken(d: DbOrTx, raw: string, type: "email_verify" | "password_reset"): Promise<string> {
  const [row] = await d
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.tokenHash, sha256(raw)),
        eq(verificationTokens.type, type),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: verificationTokens.userId });
  if (!row) throw new AppError("TOKEN_INVALID", "This link is invalid or has expired");
  return row.userId;
}

export async function sendVerificationEmail(userId: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || u.emailVerifiedAt) return;
  const raw = await createOneTimeToken(db, u.id, "email_verify", VERIFY_TTL_MS);
  const url = `${env().APP_URL}/verify-email?token=${encodeURIComponent(raw)}`;
  await sendMail(verificationMail(u.email, u.locale, url)).catch((err) => log.error("verification_mail_failed", { err, userId }));
}

export async function verifyEmail(raw: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const userId = await consumeToken(tx, raw, "email_verify");
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)));
  });
}

// ------------------------------------------------------------ register / login

export async function register(
  input: { name: string; email: string; password: string; locale: Locale },
  meta: SessionMeta,
): Promise<{ user: UserDTO; tokens: IssuedTokens }> {
  const db = await getDb();
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw new AppError("EMAIL_TAKEN", "An account already exists for this email");
    const [u] = await tx
      .insert(users)
      .values({ email, name: input.name.trim(), passwordHash, locale: input.locale, lastLoginAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!u) throw new AppError("EMAIL_TAKEN", "An account already exists for this email");
    const tokens = await issueSession(tx, u, meta);
    return { user: await toUserDTO(tx, u), tokens };
  });
  await sendVerificationEmail(result.user.id);
  log.info("user_registered", { userId: result.user.id });
  return result;
}

export async function login(input: { email: string; password: string }, meta: SessionMeta): Promise<{ user: UserDTO; tokens: IssuedTokens }> {
  const db = await getDb();
  const email = normalizeEmail(input.email);
  const [u] = await db.select().from(users).where(eq(users.email, email));

  if (u?.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
    await verifyPassword(null, input.password); // keep timing uniform
    throw new AppError("ACCOUNT_LOCKED", "Too many failed attempts. Try again later.", {
      retryAfter: Math.ceil((u.lockedUntil.getTime() - Date.now()) / 1000),
    });
  }

  const ok = await verifyPassword(u?.passwordHash ?? null, input.password);
  if (!u || !ok) {
    if (u) {
      const failed = u.failedLoginCount + 1;
      await db
        .update(users)
        .set({
          failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : u.lockedUntil,
        })
        .where(eq(users.id, u.id));
      if (failed >= MAX_FAILED_LOGINS) log.warn("account_locked", { userId: u.id, ip: meta.ip });
    }
    throw new AppError("INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  if (u.status !== "active") throw new AppError("ACCOUNT_DISABLED", "This account is disabled");

  return db.transaction(async (tx) => {
    const [fresh] = await tx
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, u.id))
      .returning();
    const tokens = await issueSession(tx, fresh, meta);
    return { user: await toUserDTO(tx, fresh), tokens };
  });
}

/**
 * Sign-in with a verified Google identity.
 * Linking rule: an existing account with the same email is linked. If that
 * account's email was never verified, its password is wiped and sessions
 * revoked — someone may have pre-registered the address to hijack it later.
 */
export async function loginWithGoogle(
  profile: { sub: string; email: string; name: string; locale: Locale },
  meta: SessionMeta,
): Promise<{ user: UserDTO; tokens: IssuedTokens }> {
  const db = await getDb();
  const email = normalizeEmail(profile.email);
  return db.transaction(async (tx) => {
    let [u] = await tx.select().from(users).where(eq(users.googleSub, profile.sub));
    if (!u) {
      const [byEmail] = await tx.select().from(users).where(eq(users.email, email)).for("update");
      if (byEmail) {
        if (!byEmail.emailVerifiedAt) await revokeAllForUser(tx, byEmail.id);
        [u] = await tx
          .update(users)
          .set({
            googleSub: profile.sub,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
            passwordHash: byEmail.emailVerifiedAt ? byEmail.passwordHash : null,
          })
          .where(eq(users.id, byEmail.id))
          .returning();
        log.info("google_linked", { userId: u.id });
      } else {
        [u] = await tx
          .insert(users)
          .values({ email, name: profile.name.slice(0, 80) || email.split("@")[0], googleSub: profile.sub, emailVerifiedAt: new Date(), locale: profile.locale })
          .returning();
        log.info("user_registered", { userId: u.id, via: "google" });
      }
    }
    if (u.status !== "active") throw new AppError("ACCOUNT_DISABLED", "This account is disabled");
    const [fresh] = await tx.update(users).set({ lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, u.id)).returning();
    const tokens = await issueSession(tx, fresh, meta);
    return { user: await toUserDTO(tx, fresh), tokens };
  });
}

// ------------------------------------------------------------ passwords

/** Always resolves (no account enumeration); mails a reset link when the account exists. */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, normalizeEmail(emailInput)));
  if (!u || u.status !== "active") return;
  const raw = await createOneTimeToken(db, u.id, "password_reset", RESET_TTL_MS);
  const url = `${env().APP_URL}/reset-password?token=${encodeURIComponent(raw)}`;
  await sendMail(resetMail(u.email, u.locale, url)).catch((err) => log.error("reset_mail_failed", { err, userId: u.id }));
}

export async function resetPassword(raw: string, newPassword: string): Promise<void> {
  const db = await getDb();
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    const userId = await consumeToken(tx, raw, "password_reset");
    // Possessing the mailbox link proves email ownership.
    await tx
      .update(users)
      .set({ passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));
    await revokeAllForUser(tx, userId);
    log.info("password_reset", { userId });
  });
}

export async function changePassword(userId: string, current: string | undefined, next: string, meta: SessionMeta) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("UNAUTHENTICATED");
  if (u.passwordHash && !(await verifyPassword(u.passwordHash, current ?? ""))) {
    throw new AppError("INVALID_CREDENTIALS", "Current password is incorrect", { fields: { currentPassword: "incorrect" } });
  }
  const passwordHash = await hashPassword(next);
  return db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await revokeAllForUser(tx, userId); // sign out every other device
    const [fresh] = await tx.select().from(users).where(eq(users.id, userId));
    return issueSession(tx, fresh, meta); // keep this device signed in
  });
}

// ------------------------------------------------------------ profile

export async function updateProfile(
  userId: string,
  patch: { name?: string; phone?: string | null; locale?: Locale; defaultAddress?: Omit<AddressDTO, "id"> | null },
): Promise<UserDTO> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const set: Partial<typeof users.$inferInsert> = {};
    if (patch.name !== undefined) set.name = patch.name.trim();
    if (patch.phone !== undefined) set.phone = patch.phone?.trim() || null;
    if (patch.locale !== undefined) set.locale = patch.locale;
    if (Object.keys(set).length) await tx.update(users).set(set).where(eq(users.id, userId));
    if (patch.defaultAddress !== undefined) await upsertDefaultAddress(tx, userId, patch.defaultAddress);
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    return toUserDTO(tx, u);
  });
}

export async function upsertDefaultAddress(d: DbOrTx, userId: string, addr: Omit<AddressDTO, "id"> | null) {
  const [current] = await d
    .select({ id: addresses.id })
    .from(addresses)
    .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
  if (!addr) {
    if (current) await d.delete(addresses).where(eq(addresses.id, current.id));
    return;
  }
  const values = {
    fullName: addr.fullName.trim(),
    phone: addr.phone?.trim() || null,
    line1: addr.line1.trim(),
    commune: addr.commune.trim(),
    wilaya: addr.wilaya,
    postalCode: addr.postalCode?.trim() || null,
  };
  if (current) await d.update(addresses).set(values).where(eq(addresses.id, current.id));
  else await d.insert(addresses).values({ ...values, userId, isDefault: true });
}

export async function listAddresses(userId: string): Promise<AddressDTO[]> {
  const db = await getDb();
  const rows = await db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), desc(addresses.updatedAt));
  return rows.map((a) => ({ id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, commune: a.commune, wilaya: a.wilaya, postalCode: a.postalCode }));
}
