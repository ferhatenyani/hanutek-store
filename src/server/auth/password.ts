import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Algorithm.Argon2id (const enum value; inlined because isolatedModules forbids ambient const enums)
const ARGON2ID = 2;

// OWASP-recommended Argon2id baseline (19 MiB, t=2, p=1).
const OPTS = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => hash(plain, OPTS);

let dummy: Promise<string> | null = null;

/**
 * Verifies a password. When `stored` is null (unknown user / OAuth-only
 * account) it still burns an equivalent hash so response timing does not
 * reveal whether the account exists.
 */
export async function verifyPassword(stored: string | null, plain: string): Promise<boolean> {
  if (!stored) {
    dummy ??= hash("timing-equalizer-password", OPTS);
    await verify(await dummy, plain).catch(() => false);
    return false;
  }
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}
