/**
 * Boots the app for the Playwright suite against a dedicated, freshly seeded
 * database (never the dev database):
 *   1. seed .data/e2e with realistic data (scripts/e2e-seed.ts)
 *   2. production build into .next-e2e (skipped with E2E_SKIP_BUILD=1 when one exists)
 *   3. next start on E2E_PORT (default 3200)
 *
 * Playwright starts this through `webServer` (see playwright.config.ts).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const port = process.env.E2E_PORT ?? "3200";
const env = {
  ...process.env,
  NODE_ENV: "production",
  LOCAL_PREVIEW: "1",
  APP_URL: `http://localhost:${port}`,
  DATABASE_URL: "pglite:./.data/e2e",
  NEXT_DIST_DIR: ".next-e2e",
  JWT_SECRET: "e2e-only-secret-0123456789-0123456789-0123456789",
  ACCESS_TOKEN_TTL_SEC: "3600",
  RATE_LIMIT_DISABLED: "1",
  MAIL_DRIVER: "console",
  STORAGE_DRIVER: "local",
  LOG_LEVEL: "error",
  NEXT_TELEMETRY_DISABLED: "1",
};
const bin = (name) => `${cwd}/node_modules/${name}`;
const run = (args, label) => {
  console.log(`[e2e] ${label}`);
  const r = spawnSync(process.execPath, args, { cwd, env, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[e2e] ${label} failed`);
    process.exit(r.status ?? 1);
  }
};

run([bin("tsx/dist/cli.mjs"), "--conditions=react-server", "scripts/e2e-seed.ts", ".data/e2e"], "seeding the e2e database");
if (process.env.E2E_SKIP_BUILD === "1" && existsSync(`${cwd}/.next-e2e/BUILD_ID`)) console.log("[e2e] reusing .next-e2e build");
else run([bin("next/dist/bin/next"), "build"], "building (.next-e2e)");

console.log(`[e2e] starting on http://localhost:${port}`);
const server = spawn(process.execPath, [bin("next/dist/bin/next"), "start", "-p", port], { cwd, env, stdio: "inherit" });
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
