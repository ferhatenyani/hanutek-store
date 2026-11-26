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
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const port = process.env.E2E_PORT ?? "3200";
const oidcPort = process.env.OIDC_PORT ?? "3299";
const tlsPort = process.env.E2E_TLS_PORT ?? "3443";
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
  // every e-mail lands as JSON in the outbox, so tests can open verify/reset links
  MAIL_DRIVER: "file",
  MAIL_OUTBOX_DIR: ".data/e2e-outbox",
  // Google sign-in against the local stand-in provider (scripts/e2e-oidc-mock.mjs)
  GOOGLE_CLIENT_ID: "e2e-client",
  GOOGLE_CLIENT_SECRET: "e2e-secret",
  GOOGLE_OIDC_BASE: `http://localhost:${oidcPort}`,
  OIDC_PORT: oidcPort,
  // the HTTPS front (below) is a second origin for the same app
  ADMIN_ORIGINS: `https://localhost:${tlsPort}`,
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
rmSync(`${cwd}/.data/e2e-outbox`, { recursive: true, force: true });
if (process.env.E2E_SKIP_BUILD === "1" && existsSync(`${cwd}/.next-e2e/BUILD_ID`)) console.log("[e2e] reusing .next-e2e build");
else run([bin("next/dist/bin/next"), "build"], "building (.next-e2e)");

const oidc = spawn(process.execPath, ["scripts/e2e-oidc-mock.mjs"], { cwd, env, stdio: "inherit" });

/*
 * HTTPS front for the WebKit projects. Playwright's WebKit (Windows/Linux)
 * drops `Secure` cookies on http://localhost, so signed-in journeys can only
 * be tested on WebKit over TLS — like real Safari in production. A throwaway
 * self-signed certificate is generated with openssl; without openssl the
 * front is skipped (WebKit sign-in tests will then fail, by design).
 */
function startTlsFront() {
  const dir = `${cwd}/.data/e2e-tls`;
  if (!existsSync(`${dir}/cert.pem`)) {
    mkdirSync(dir, { recursive: true });
    const r = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost", "-keyout", `${dir}/key.pem`, "-out", `${dir}/cert.pem`], { stdio: "ignore" });
    if (r.status !== 0) return console.warn("[e2e] openssl unavailable: no HTTPS front for WebKit");
  }
  createHttpsServer({ key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) }, (req, res) => {
    const up = httpRequest({ host: "127.0.0.1", port, method: req.method, path: req.url, headers: { ...req.headers, "x-forwarded-proto": "https" } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  }).listen(tlsPort, () => console.log(`[e2e] HTTPS front on https://localhost:${tlsPort}`));
}
startTlsFront();
console.log(`[e2e] starting on http://localhost:${port}`);
const server = spawn(process.execPath, [bin("next/dist/bin/next"), "start", "-p", port], { cwd, env, stdio: "inherit" });
const stop = () => {
  oidc.kill();
  server.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  oidc.kill();
  process.exit(code ?? 0);
});
