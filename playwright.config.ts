import { defineConfig, devices } from "@playwright/test";

/**
 * Admin E2E suite: real backend, real (isolated, freshly seeded) database,
 * production build. No mocked responses.
 *
 *   npm run test:e2e                     full run (seed + build + test)
 *   E2E_SKIP_BUILD=1 npm run test:e2e    reuse the last .next-e2e build
 *
 * Tests share one server and one database, so they run serially and only
 * assert on data they create or on relative changes.
 */
const port = Number(process.env.E2E_PORT ?? 3200);
const baseURL = `http://localhost:${port}`;

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
    // the system Chrome (or Playwright's cached Chromium) — no browser download needed
    channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
    locale: "en-GB",
    timezoneId: "Africa/Algiers",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "desktop",
      testIgnore: /responsive\.spec\.ts|global\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome", storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },
    {
      name: "responsive",
      testMatch: /responsive\.spec\.ts/,
      use: { channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome", storageState: "e2e/.auth/admin.json" },
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
