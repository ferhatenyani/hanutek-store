import { apiAs, contextAs, expect, login, ready, test } from "./fixtures";

test.describe("authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated visitors are sent to the login page and back after sign-in", async ({ page }) => {
    await page.goto("/admin/orders?status=packed");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders%3Fstatus%3Dpacked/);
    await page.getByLabel("E-mail").fill("admin@hanutek.test");
    await page.getByLabel("Mot de passe", { exact: true }).fill("Admin-pass-2026!");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/admin\/orders\?status=packed$/);
    await expect(page.getByRole("tab", { name: "À expédier", selected: true })).toBeVisible();
  });

  test("validates the form and explains a wrong password", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Saisissez une adresse e-mail valide")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
    await page.getByLabel("E-mail").fill("admin@hanutek.test");
    await page.getByLabel("Mot de passe", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("E-mail ou mot de passe incorrect.");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("password visibility toggle", async ({ page }) => {
    await page.goto("/admin/login");
    const pw = page.getByLabel("Mot de passe", { exact: true });
    await pw.fill("secret");
    await expect(pw).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(pw).toHaveAttribute("type", "text");
  });

  test("customer accounts are refused and not left signed in", async ({ page }) => {
    await login(page, "customer");
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("n’a pas accès à la console d’administration");
    const me = await apiAs(page, "GET", "/admin/me");
    expect(me.status).toBe(401);
  });

  test("an open-redirect `next` is ignored", async ({ page }) => {
    await login(page, "staff", "https://evil.example/phish");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("sign out ends the session", async ({ page }) => {
    await login(page, "staff");
    await ready(page);
    await page.getByRole("button", { name: "Menu du compte" }).first().click();
    await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("an expired access token is renewed transparently with the refresh cookie", async ({ page, context }) => {
    await login(page, "staff");
    await ready(page);
    // drop the access token only (as if it had expired); the refresh cookie remains
    const cookies = await context.cookies();
    await context.clearCookies();
    await context.addCookies(cookies.filter((c) => !/ht_at$/.test(c.name)));
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Commandes" })).toBeVisible();
    expect((await context.cookies()).some((c) => /ht_at$/.test(c.name))).toBe(true);
  });

  test("a revoked session sends the user back to login with a notice", async ({ page, context }) => {
    await login(page, "staff");
    await ready(page);
    await context.clearCookies();
    await page.getByRole("link", { name: "Produits" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login\?next=.*expired=1/);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("session a expiré");
  });
});

test.describe("role-based access", () => {
  test("staff see only what their role allows", async ({ browser }) => {
    const ctx = await contextAs(browser, "staff");
    const page = await ctx.newPage();
    await page.goto("/admin");
    await ready(page);
    const nav = page.getByRole("navigation", { name: "Administration" });
    await expect(nav.getByRole("link", { name: "Commandes" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Codes promo" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Journal d’audit" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Activité de l’équipe" })).toHaveCount(0);

    await page.goto("/admin/promotions");
    await expect(page.getByRole("heading", { name: "Vous n’avez pas accès à cette page" })).toBeVisible();
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Vous n’avez pas accès à cette page" })).toBeVisible();
    await page.goto("/admin/settings");
    await expect(page.getByRole("tab", { name: "Système" })).toHaveCount(0);
    await page.goto("/admin/shipping");
    await expect(page.getByRole("button", { name: "Ajouter un transporteur" })).toHaveCount(0);
    await page.goto("/admin/team");
    await expect(page.getByRole("button", { name: "Ajouter un membre" })).toHaveCount(0);

    // the server refuses even if the UI is bypassed
    expect((await apiAs(page, "POST", "/admin/promotions", { code: "HACK50", type: "percent", value: 50 })).status).toBe(403);
    expect((await apiAs(page, "GET", "/admin/audit")).status).toBe(403);
    expect((await apiAs(page, "POST", "/admin/carriers", { name: "Rogue" })).status).toBe(403);
    expect((await apiAs(page, "GET", "/admin/system")).status).toBe(403);
    await ctx.close();
  });

  test("staff cannot manage accounts", async ({ browser, page }) => {
    // find a customer id with the admin session
    const list = await (await page.request.get("/api/v1/admin/customers?search=customer%40hanutek.test")).json();
    const id = list.items[0].id as string;
    const ctx = await contextAs(browser, "staff");
    const staff = await ctx.newPage();
    await staff.goto(`/admin/customers/${id}`);
    await expect(staff.getByRole("heading", { name: /Karim Haddad/ })).toBeVisible();
    await expect(staff.getByRole("button", { name: "Gérer le compte" })).toHaveCount(0);
    await expect(staff.getByRole("combobox", { name: "Rôle" })).toHaveCount(0);
    expect((await apiAs(staff, "PATCH", `/admin/customers/${id}`, { status: "disabled" })).status).toBe(403);
    await ctx.close();
  });

  test("a customer session cannot open the console", async ({ browser }) => {
    const ctx = await contextAs(browser, "customer");
    const page = await ctx.newPage();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Ce compte ne peut pas utiliser la console d’administration" })).toBeVisible();
    expect((await apiAs(page, "GET", "/admin/orders")).status).toBe(403);
    await ctx.close();
  });

  test("cross-site requests with the admin cookie are rejected (CSRF)", async ({ page }) => {
    const res = await page.request.post("/api/v1/admin/promotions", { data: { code: "CSRF1", type: "percent", value: 10 }, headers: { origin: "https://evil.example" } });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe("CSRF");
  });
});
