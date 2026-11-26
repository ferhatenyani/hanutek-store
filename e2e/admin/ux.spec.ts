import { expect, ready, test } from "./fixtures";

const PAGES = ["/admin", "/admin/orders", "/admin/shipping", "/admin/customers", "/admin/promotions", "/admin/products", "/admin/inventory", "/admin/categories", "/admin/reviews", "/admin/subscribers", "/admin/team", "/admin/audit", "/admin/settings"];

test.describe("UX & accessibility", () => {
  test("every page loads without errors and every control has an accessible name", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await ready(page);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("button, a[href], input, textarea, [role=combobox], [role=switch], [role=checkbox]")]
          .filter((el) => el.offsetParent !== null)
          .filter((el) => {
            const label = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent?.trim() || el.getAttribute("title") || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest("label");
            return !label;
          })
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(unnamed, `unnamed controls on ${path}`).toEqual([]);
    }
  });

  test("no native <select> elements and no default-styled date inputs", async ({ page }) => {
    for (const path of ["/admin/orders", "/admin/promotions?new=1", "/admin/products/new"]) {
      await page.goto(path);
      await ready(page);
      expect(await page.locator("select, input[type=date], input[type=datetime-local]").count(), path).toBe(0);
    }
  });

  test("dialogs trap focus, close on Escape and restore focus", async ({ page }) => {
    await page.goto("/admin/categories");
    const trigger = page.getByRole("button", { name: "Nouvelle catégorie" });
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: "Nouvelle catégorie" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel("Nom", { exact: true })).toBeFocused();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    // a select inside the drawer closes on its own Escape without closing the drawer
    await drawer.getByRole("combobox", { name: "Catégorie parente" }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("the page behind a dialog doesn't scroll, and scrolling is restored", async ({ page }) => {
    await page.goto("/admin/categories");
    await ready(page);
    await page.getByRole("button", { name: "Nouvelle catégorie" }).click();
    await expect(page.getByRole("dialog", { name: "Nouvelle catégorie" })).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
    await page.goto("/admin/orders");
    await expect(page.getByRole("table", { name: "Commandes" })).toBeVisible();
    await page.mouse.move(900, 500); // over the content, not the fixed sidebar
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("custom select is keyboard operable", async ({ page }) => {
    await page.goto("/admin/orders");
    const payment = page.getByRole("combobox", { name: "Paiement" });
    await payment.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/payment=unpaid/);
    await expect(payment).toBeFocused();
  });

  test("command palette: navigate, search orders, quick actions", async ({ page }) => {
    await page.goto("/admin");
    await ready(page);
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Palette de commandes" });
    await expect(palette).toBeVisible();
    await page.keyboard.type("inventaire");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/inventory/);

    const number = (await (await page.request.get("/api/v1/admin/orders?pageSize=1")).json()).items[0].number as string;
    await page.keyboard.press("Control+k");
    await page.keyboard.type(number);
    await expect(palette.getByRole("option", { name: new RegExp(number) })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await palette.getByRole("option", { name: new RegExp(number) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/orders/${number}`));
  });

  test("two-key shortcuts and the help dialog", async ({ page }) => {
    await page.goto("/admin");
    await ready(page);
    await page.keyboard.press("g");
    await page.keyboard.press("p");
    await expect(page).toHaveURL(/\/admin\/products$/);
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Raccourcis clavier" })).toBeVisible();
  });

  test("dark theme persists across reloads without a flash", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Sombre", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-admin-theme", "dark");
    await page.reload();
    // set by the inline script before hydration
    await expect(page.locator("html")).toHaveAttribute("data-admin-theme", "dark");
    const bg = await page.locator(".adm").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(11, 11, 12)");
    await page.getByRole("button", { name: "Clair", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-admin-theme", "light");
  });

  test("dashboard layout is stable while data loads (CLS)", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as PerformanceEntry[] & { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/admin");
    await ready(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.1);
  });

  test("unknown console paths show the admin 404 inside the shell", async ({ page }) => {
    await page.goto("/admin/does-not-exist");
    await expect(page.getByRole("heading", { name: "Cette page n’existe pas" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Administration" })).toBeVisible();
  });

  test("the storefront is unaffected by the admin app", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator(".adm")).toHaveCount(0);
    await page.goto("/products");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
});
