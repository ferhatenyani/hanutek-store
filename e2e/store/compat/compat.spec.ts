import { test, expect, gotoStore, expectNoHorizontalOverflow, fillCheckout, pageApi, toastText, registerVia } from "../support";

/**
 * Cross-browser compatibility. Runs on WebKit as iPhone 15 / iPhone SE / iPad
 * (Safari and Chrome on iOS both use WebKit), Android Chrome and desktop
 * Firefox. Known mobile-browser pitfalls checked here:
 *  - iOS focus zoom on inputs < 16px
 *  - 100vh vs dynamic toolbars (sheets sized with dvh)
 *  - position: fixed + safe-area insets (dock, sheet footer)
 *  - Intl currency formatting differences → hydration mismatches
 *  - secure cookies on http://localhost, view transitions support
 */
const touch = (info: { project: { use: { hasTouch?: boolean } } }) => Boolean(info.project.use.hasTouch);

test("guest journey: browse → add → checkout → confirmation", async ({ page, admin }, info) => {
  const p = await admin.product({ variants: [{ price: 4200, stock: 10 }] });
  await gotoStore(page, "/");
  await expectNoHorizontalOverflow(page, "home");
  await gotoStore(page, `/products/${p.slug}`);
  await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
  await expect(toastText(page, "Ajouté au panier")).toBeVisible();

  const vp = page.viewportSize()!;
  let form;
  if (vp.width < 1024) {
    await page.getByRole("button", { name: "Panier", exact: true }).last().click();
    const sheet = page.getByRole("dialog", { name: "Panier" });
    await sheet.getByRole("button", { name: "Voir le panier" }).click();
    await sheet.getByRole("button", { name: "Passer commande" }).click();
    form = sheet.locator("#sheet-checkout");
    // the sheet fills the *visible* viewport (dvh), not the larger layout viewport
    const box = (await sheet.locator("> div").last().boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  } else {
    await gotoStore(page, "/cart");
    await page.getByRole("button", { name: "Passer commande" }).click();
    form = page.locator("#checkout");
  }
  await fillCheckout(form, { phone: `07${Math.floor(10_000_000 + Math.random() * 89_999_999)}` });
  await form.getByRole("button", { name: /Confirmer la commande/ }).click();
  await expect(page).toHaveURL(/\/order\/HT-\d+\?confirmed=1/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Merci — commande confirmée" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/HT-\d+/).first()).toBeVisible();
  await info.attach("confirmation", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("sign-in works (secure, prefixed cookies are accepted by this engine)", async ({ page }) => {
  const c = await registerVia(page.context().request);
  await page.context().clearCookies();
  await gotoStore(page, "/login");
  await page.getByLabel("E-mail", { exact: true }).fill(c.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(c.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  expect((await pageApi(page, "GET", "/me")).status).toBe(200);
});

test("no input zooms the page on focus (font-size ≥ 16px on touch)", async ({ page, admin }, info) => {
  test.skip(!touch(info), "desktop pointer");
  const p = await admin.product();
  await gotoStore(page, "/");
  await pageApi(page, "POST", "/cart/items", { variantId: p.variants[0].id, qty: 1 });
  for (const url of ["/", "/login", "/register"]) {
    await gotoStore(page, url);
    if (url === "/") {
      const btn = page.getByRole("button", { name: "Rechercher" });
      if (await btn.isVisible()) await btn.click();
    }
    for (const el of await page.locator("input:not([type=checkbox]):visible").all()) {
      const fs = await el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(fs, `${url} input font-size`).toBeGreaterThanOrEqual(16);
    }
  }
  // focusing must not change the visual viewport scale
  await gotoStore(page, "/login");
  const before = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  await page.getByLabel("E-mail", { exact: true }).tap();
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(before);
});

test("viewport meta allows user zoom and covers the notch; fixed dock respects the safe area", async ({ page }, info) => {
  await gotoStore(page, "/");
  const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(meta).toContain("width=device-width");
  expect(meta).toContain("viewport-fit=cover");
  expect(meta).not.toMatch(/user-scalable=no|maximum-scale=1(\D|$)/); // never block pinch zoom (a11y)
  if (page.viewportSize()!.width < 1024) {
    const dock = page.getByRole("link", { name: "Accueil" }).last();
    const box = (await dock.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  void info;
});

test("prices render identically on server and client (no hydration mismatch from Intl)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && /hydrat|did not match/i.test(m.text()) && errors.push(m.text()));
  await gotoStore(page, "/products");
  await gotoStore(page, "/");
  expect(errors).toEqual([]);
  const price = await page.locator(".num").filter({ hasText: /\d/ }).first().textContent();
  expect(price).toMatch(/DA/);
});

test("navigation and back/forward keep the page intact (view transitions or the fallback)", async ({ page }) => {
  await gotoStore(page, "/");
  await page.goto("/products");
  await page.locator(".product-grid > * a").first().click();
  await expect(page).toHaveURL(/\/products\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.locator(".product-grid")).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await expectNoHorizontalOverflow(page, "after back/forward");
});

test("Arabic (RTL) renders without overflow and with mirrored layout", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hanutek-locale", "ar"));
  await gotoStore(page, "/products");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoHorizontalOverflow(page, "ar products");
  const logo = (await page.getByRole("link", { name: "hanutek", exact: true }).boundingBox())!;
  expect(logo.x).toBeGreaterThan(page.viewportSize()!.width / 2); // logo sits on the right in RTL
});

test("tapping the dock doesn't leave a hover tooltip stuck on screen (touch 'sticky hover')", async ({ page }, info) => {
  test.skip(!touch(info) || page.viewportSize()!.width >= 1024, "dock is a touch/phone control");
  await gotoStore(page, "/");
  await page.getByRole("link", { name: "Favoris" }).last().tap();
  await expect(page).toHaveURL(/\/favorites$/);
  // the label tooltips are positioned just above the dock icons
  await expect(page.locator(".whitespace-pre").filter({ hasText: /^(Accueil|Boutique|Panier|Favoris|Profil)$/ })).toHaveCount(0);
});
