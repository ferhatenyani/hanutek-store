import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite: real backend, real (isolated, freshly seeded) database,
 * production build. No mocked API responses — only true externals are
 * stand-ins (file mail outbox, local OpenID provider for Google sign-in).
 *
 *   npm run test:e2e                     full run (seed + build + every project)
 *   E2E_SKIP_BUILD=1 npm run test:e2e    reuse the last .next-e2e build
 *   npx playwright test --project=store-desktop   one area
 *
 * Projects
 *   admin-*            the back-office console (e2e/admin)
 *   store-desktop      storefront journeys, business rules and API security (e2e/store/functional, e2e/store/security)
 *   store-mobile       responsive + UX audit on touch devices, FR/LTR and AR/RTL (e2e/store/responsive)
 *   store-<browser>    cross-browser compatibility: iOS Safari / Chrome-on-iOS (WebKit), iPad, Android Chrome, Firefox (e2e/store/compat)
 *
 * Tests share one server and one database, so they run serially and assert
 * only on data they create, or on relative changes.
 */
const port = Number(process.env.E2E_PORT ?? 3200);
const baseURL = `http://localhost:${port}`;
const chrome = process.env.E2E_BROWSER_CHANNEL ?? "chrome";
const store = { locale: "fr-FR", timezoneId: "Africa/Algiers", storageState: undefined };
/** WebKit keeps `Secure` cookies only over TLS: its projects go through the HTTPS front (scripts/e2e-server.mjs). */
const tls = { baseURL: `https://localhost:${process.env.E2E_TLS_PORT ?? 3443}`, ignoreHTTPSErrors: true };

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    // no global `channel`: an undefined override doesn't unset it, so the Chromium
    // projects set it themselves and WebKit/Firefox use their own engines
    locale: "en-GB",
    timezoneId: "Africa/Algiers",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/, use: { channel: chrome } },

    // ---------------------------------------------------------------- admin
    {
      name: "admin-desktop",
      testMatch: /admin\/(?!responsive).*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, channel: chrome, storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },
    {
      name: "admin-responsive",
      testMatch: /admin\/responsive\.spec\.ts/,
      use: { channel: chrome, storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },

    // ---------------------------------------------------------------- storefront
    {
      name: "store-desktop",
      testMatch: /store\/(functional|security)\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, channel: chrome, ...store },
      dependencies: ["setup"],
    },
    {
      name: "store-mobile",
      testMatch: /store\/responsive\/.*\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: chrome, ...store },
      dependencies: ["setup"],
    },
    // iOS: Safari and Chrome on iOS both run on WebKit — the closest engine Playwright offers.
    {
      name: "store-iphone",
      testMatch: /store\/compat\/.*\.spec\.ts/,
      use: { ...devices["iPhone 15"], ...store, ...tls },
      dependencies: ["setup"],
    },
    {
      name: "store-iphone-se",
      testMatch: /store\/compat\/.*\.spec\.ts/,
      use: { ...devices["iPhone SE"], ...store, ...tls },
      dependencies: ["setup"],
    },
    {
      name: "store-ipad",
      testMatch: /store\/compat\/.*\.spec\.ts/,
      use: { ...devices["iPad (gen 7)"], ...store, ...tls },
      dependencies: ["setup"],
    },
    {
      name: "store-android",
      testMatch: /store\/compat\/.*\.spec\.ts/,
      use: { ...devices["Galaxy S9+"], channel: chrome, ...store },
      dependencies: ["setup"],
    },
    {
      name: "store-firefox",
      testMatch: /store\/compat\/.*\.spec\.ts/,
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 }, ...store },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `${baseURL}/api/v1/health`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI && process.env.E2E_REUSE === "1",
    stdout: "pipe",
    stderr: "pipe",
    env: { E2E_PORT: String(port) },
  },
});
