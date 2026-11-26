import { test as setup, expect } from "@playwright/test";
import { USERS } from "./admin/fixtures";

/** Signs each role in once and stores the cookies for the other projects. */
for (const who of ["admin", "staff", "customer"] as const) {
  setup(`sign in as ${who}`, async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(USERS[who].email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(USERS[who].password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    if (who === "customer") {
      // customers are refused by the console but keep a store session
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("n’a pas accès");
      await page.request.post("/api/v1/auth/login", { data: { email: USERS.customer.email, password: USERS.customer.password }, headers: { origin: new URL(page.url()).origin } });
    } else {
      await expect(page.locator("#admin-main")).toBeVisible({ timeout: 30_000 });
    }
    await page.context().storageState({ path: `e2e/.auth/${who}.json` });
  });
}
