import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";

export const USERS = {
  admin: { email: "admin@hanutek.test", password: "Admin-pass-2026!", name: "Nadia Admin" },
  staff: { email: "staff@hanutek.test", password: "Staff-pass-2026!", name: "Sara Belkacem" },
  staff2: { email: "staff2@hanutek.test", password: "Staff2-pass-2026!", name: "Yanis Ouali" },
  customer: { email: "customer@hanutek.test", password: "Customer-pass-2026!", name: "Karim Haddad" },
} as const;
export type Who = keyof typeof USERS;

/** Console noise that is expected and not an application error. */
const IGNORED = [/Failed to load resource/i, /status of 40[13]/i, /status of 409/i, /status of 422/i, /Download the React DevTools/i];

/**
 * Every test fails if the page throws or logs a console error — catches
 * React warnings (nested buttons, key warnings, hydration mismatches) too.
 */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) errors.push(`console: ${m.text().slice(0, 400)}`);
      });
      await use(errors);
      expect(errors, "page errors / console errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function login(page: Page, who: Who, next?: string) {
  await page.goto(`/admin/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(USERS[who].email);
  await page.getByLabel("Password", { exact: true }).fill(USERS[who].password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** A fresh, signed-in context for another user (e.g. a second admin tab or a staff member). */
export async function contextAs(browser: import("@playwright/test").Browser, who: "admin" | "staff" | "customer", viewport = { width: 1440, height: 900 }): Promise<BrowserContext> {
  return browser.newContext({ storageState: `e2e/.auth/${who}.json`, viewport, locale: "en-GB", timezoneId: "Africa/Algiers" });
}

export const toast = (page: Page, text: string | RegExp) => page.locator("[role=status],[role=alert]").filter({ hasText: text }).first();

/** Waits for the console shell to be ready (session gate passed). */
export async function ready(page: Page) {
  await expect(page.locator("#admin-main")).toBeVisible();
}

/** Calls the API with the page's cookies (same-origin, so CSRF rules apply like in the app). */
export async function apiAs(page: Page, method: string, path: string, body?: unknown) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const r = await fetch(`/api/v1${path}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
      let json: unknown = null;
      try {
        json = await r.json();
      } catch {
        /* non-JSON */
      }
      return { status: r.status, json: json as Record<string, unknown> };
    },
    { method, path, body },
  );
}

/** Opens a filter Select by its accessible name and picks an option. */
export async function pick(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: typeof option === "string" }).first().click();
}
