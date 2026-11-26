import { test, expect, gotoStore, registerVia, pageApi, setLocale } from "../support";

test.describe("accessibility", () => {
  test("every control has an accessible name and every input a label, on every storefront page", async ({ page, admin }) => {
    const p = await admin.product();
    await registerVia(page.context().request);
    await gotoStore(page, "/");
    await pageApi(page, "POST", "/cart/items", { variantId: p.variants[0].id, qty: 1 });
    const problems: string[] = [];
    for (const url of ["/", "/products", `/products/${p.slug}`, "/cart", "/favorites", "/profile", "/profile?tab=settings"]) {
      await gotoStore(page, url);
      const found = await page.evaluate(() => {
        const out: string[] = [];
        const name = (el: Element) =>
          (el.getAttribute("aria-label") ||
            el.getAttribute("aria-labelledby") ||
            (el as HTMLElement).innerText ||
            el.getAttribute("title") ||
            el.querySelector("img[alt]")?.getAttribute("alt") ||
            "").trim();
        for (const el of document.querySelectorAll("button, a[href], [role=button], [role=option], [role=tab]")) {
          if ((el as HTMLElement).offsetParent === null) continue;
          if (!name(el)) out.push(`${el.tagName.toLowerCase()} ${el.outerHTML.slice(0, 90)}`);
        }
        for (const el of document.querySelectorAll<HTMLInputElement>("input:not([type=hidden]), textarea")) {
          if (el.offsetParent === null) continue;
          const labelled = el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
          if (!labelled) out.push(`input without label: ${el.outerHTML.slice(0, 90)}`);
          if (el.labels && [...el.labels].some((l) => l.querySelector("a, button"))) out.push(`label contains interactive content: ${el.outerHTML.slice(0, 60)}`);
        }
        const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
        for (const dup of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) out.push(`duplicate id #${dup}`);
        if (!document.querySelector("h1")) out.push("no h1");
        for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) out.push(`img without alt ${img.src}`);
        return out;
      });
      problems.push(...found.map((f) => `${url}: ${f}`));
    }
    expect(problems).toEqual([]);
  });

  test("login form is fully keyboard operable and the password field is properly labelled", async ({ page }) => {
    const c = await registerVia(page.context().request);
    await page.context().clearCookies();
    await gotoStore(page, "/login");
    await page.getByLabel("E-mail", { exact: true }).focus();
    await page.keyboard.type(c.email);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Mot de passe", { exact: true })).toBeFocused();
    await page.keyboard.type(c.password);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("cart sheet (desktop): focus moves in, Tab is trapped, Escape closes and focus returns", async ({ page, admin }) => {
    const p = await admin.product();
    await gotoStore(page, "/");
    await pageApi(page, "POST", "/cart/items", { variantId: p.variants[0].id, qty: 1 });
    await page.reload();
    const trigger = page.getByRole("button", { name: /Ouvrir le panier/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: "Panier" });
    await expect(sheet).toBeVisible();
    await expect.poll(() => sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("keyboard focus is always visible on links and buttons", async ({ page }) => {
    await gotoStore(page, "/");
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const visible = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return true;
        // the ring may be drawn on the element or on its wrapper (e.g. the search pill's focus-within ring)
        const ring = (x: Element | null) => {
          if (!x) return false;
          const c = getComputedStyle(x);
          return (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0) || c.boxShadow !== "none";
        };
        return ring(el) || ring(el.parentElement);
      });
      expect(visible, `focus ring on tab stop ${i + 1}`).toBe(true);
    }
  });
});

test.describe("performance & stability", () => {
  test("one session bootstrap per page load and no duplicate API calls", async ({ page }) => {
    const calls: string[] = [];
    page.on("request", (r) => r.url().includes("/api/v1/") && calls.push(`${r.method()} ${new URL(r.url()).pathname}${new URL(r.url()).search}`));
    await gotoStore(page, "/");
    await page.waitForLoadState("networkidle");
    const counts = calls.reduce<Record<string, number>>((m, c) => ((m[c] = (m[c] ?? 0) + 1), m), {});
    expect(counts["POST /api/v1/auth/session"]).toBe(1);
    expect(Object.entries(counts).filter(([, n]) => n > 1)).toEqual([]);
  });

  test("layout stays stable while pages load (CLS < 0.1)", async ({ page }) => {
    for (const url of ["/", "/products"]) {
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await gotoStore(page, url);
      await page.waitForLoadState("networkidle");
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls, url).toBeLessThan(0.1);
    }
  });

  test("images are optimized (modern formats via next/image) and none are broken", async ({ page }) => {
    const types = new Set<string>();
    page.on("response", (r) => r.url().includes("/_next/image") && types.add(r.headers()["content-type"] ?? ""));
    await gotoStore(page, "/products");
    await page.waitForLoadState("networkidle");
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== "lazy").map((i) => i.src));
    expect(broken).toEqual([]);
    expect([...types].every((t) => /avif|webp/.test(t))).toBe(true);
  });

  test("pages render quickly enough on a desktop connection", async ({ page }) => {
    for (const url of ["/", "/products"]) {
      await page.goto(url);
      const nav = await page.evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).responseStart);
      expect(nav, `${url} TTFB`).toBeLessThan(1500);
    }
  });

  test("Arabic pages load without errors too", async ({ page }) => {
    await setLocale(page, "ar");
    for (const url of ["/", "/products", "/login", "/register", "/cart"]) await gotoStore(page, url);
  });
});
