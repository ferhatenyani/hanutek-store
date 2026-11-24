/**
 * Database CLI.
 *   npm run db:migrate   — apply SQL migrations from /drizzle
 *   npm run db:seed      — idempotent catalogue seed (+ first admin when SEED_ADMIN_EMAIL/PASSWORD are set)
 *   npm run db:setup     — migrate + seed
 */
import { createDb } from "../src/server/db/client";
import { seed } from "../src/server/db/seed/seed";

async function main() {
  const cmd = process.argv[2];
  // Prefer the direct (non-pooled) connection for DDL when the host provides one (Neon / Vercel).
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "pglite:./.data/pglite";
  const { db, migrate, close } = createDb(url);
  try {
    if (cmd === "migrate" || cmd === "setup") {
      await migrate();
      console.log("✓ migrations applied");
    }
    if (cmd === "seed" || cmd === "setup") {
      const summary = await seed(db, { adminEmail: process.env.SEED_ADMIN_EMAIL, adminPassword: process.env.SEED_ADMIN_PASSWORD });
      console.log("✓ seed", summary);
    }
    if (!["migrate", "seed", "setup"].includes(cmd ?? "")) {
      console.error("usage: tsx scripts/db.ts <migrate|seed|setup>");
      process.exitCode = 1;
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
