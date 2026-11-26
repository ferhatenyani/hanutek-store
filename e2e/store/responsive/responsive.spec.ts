import type { Page } from "@playwright/test";
import { test, expect, uid, gotoStore, setLocale, expectNoHorizontalOverflow, toastText, registerVia, pageApi, fillCheckout } from "../support";

/**
 * Responsive + UX audit on a touch device profile (store-mobile project:
 * Pixel 7, isMobile, hasTouch). Breakpoint sweeps resize the viewport across
 * every layout boundary, in French (LTR) and Arabic (RTL).
 */

const WIDTHS: [number, number][] = [
  [280, 653], // folded phone
  [320, 640],
  [360, 780],
  [375, 667],
  [390, 844],
  [430, 932],
  [639, 900],
  [640, 900],
  [767, 1024],
  [768, 1024],
  [1023, 768],
  [1024, 768],
  [1280, 800],
  [1920, 1080],
  [844, 390], // phone landscape
];

async function seedCart(page: Page, variantId: string, qty = 1) {
  await gotoStore(page, "/");
  const r = await pageApi(page, "POST", "/cart/items", { variantId, qty });
  expect(r.status).toBe(200);
}

/** The element at the centre of `el` is `el` itself (or inside it): nothing covers it. */
async function expectNotCovered(page: Page, selector: string, label = selector) {
  const covered = await page.evaluate((sel) => {
    const all = document.querySelectorAll<HTMLElement>(sel);
    const el = all[all.length - 1];
    if (!el) return "missing";
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + Math.min(r.height / 2, 20);
    if (y < 0 || y > window.innerHeight) return `offscreen (y=${Math.round(y)})`;
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return null;
    return `${hit.tagName.toLowerCase()}.${String(hit.className).split(" ").slice(0, 4).join(".")}`;
  }, selector);
  expect(covered, `${label} is covered by another element`).toBeNull();
}

for (const locale of ["fr", "ar"] as const) {
  test.describe(`layout sweep (${locale})`, () => {
    test(`no horizontal overflow, header and navigation usable at every width (${locale})`, async ({ page, admin }, info) => {
      test.setTimeout(240_000);
      await setLocale(page, locale);
      const long = await admin.product({
        name: `Dashcam ${uid().toUpperCase()} Professionnelle Grand Angle Vision Nocturne SuperLongModelNameWithoutAnySpacesAtAll`.slice(0, 120),
        variants: [{ price: 9_999_999, stock: 5, label: "Pack complet avec carte mémoire 256 Go et support ventouse" }],
      });
      await registerVia(page.context().request, { name: "Mohamed-Amine Benbouzid-Khelifati" });
      await seedCart(page, long.variants[0].id, 3);
      const pages = ["/", "/products", `/products/${long.slug}`, "/cart", "/favorites", "/profile", "/login", `/products?q=${encodeURIComponent("zz-no-match")}`];

      for (const [w, h] of WIDTHS) {
        await page.setViewportSize({ width: w, height: h });
        for (const url of pages) {
          await gotoStore(page, url);
          await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
          await expectNoHorizontalOverflow(page, `${url} @${w}×${h} ${locale}`, true);
          // the sticky header is on screen and the dock exists below lg
          await expect(page.locator("header").first()).toBeInViewport();
          if (w < 1024) await expect(page.getByRole("button", { name: locale === "ar" ? /السلة/ : "Panier" }).last()).toBeVisible();
        }
        if ([320, 390, 768, 1280].includes(w)) {
          await gotoStore(page, `/products/${long.slug}`);
          await info.attach(`product-${locale}-${w}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        }
      }
    });
  });
}

test.describe("mobile cart sheet & checkout (touch)", () => {
  test("expanded cart: the promo/totals footer never covers the checkout form — even with the keyboard open", async ({ page, admin }, info) => {
    const p = await admin.product({ variants: [{ price: 3500, stock: 10 }] });
    await seedCart(page, p.variants[0].id, 2);
    await gotoStore(page, "/");
    await page.getByRole("button", { name: "Panier", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Panier" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Voir le panier" }).click();
    // the pinned CTA scrolls to the form (it steps aside once the form fills the screen)
    await sheet.getByRole("button", { name: "Passer commande" }).click();
    const form = sheet.locator("#sheet-checkout");
    await expect(sheet.getByRole("button", { name: "Passer commande" })).toHaveCount(0);
    await expect(form.locator("input[name=name]")).toBeInViewport();

    for (const name of ["name", "phone", "email", "address", "commune"]) {
      await form.locator(`input[name=${name}]`).scrollIntoViewIfNeeded();
      await expectNotCovered(page, `#sheet-checkout input[name=${name}]`, name);
    }
    // the on-screen keyboard leaves ~45% of a phone screen: focused fields must still be usable
    await page.setViewportSize({ width: 412, height: 420 });
    for (const name of ["phone", "postalCode"]) {
      await form.locator(`input[name=${name}]`).focus();
      await form.locator(`input[name=${name}]`).scrollIntoViewIfNeeded();
      await expectNotCovered(page, `#sheet-checkout input[name=${name}]`, `${name} (keyboard open)`);
    }
    await info.attach("sheet-keyboard", { body: await page.screenshot(), contentType: "image/png" });
    await page.setViewportSize({ width: 412, height: 915 });

    // and the whole flow still completes from the sheet
    await fillCheckout(form, { phone: "0661 90 80 70" });
    await form.getByRole("button", { name: /Confirmer la commande/ }).click();
    await expect(page).toHaveURL(/\/order\/HT-\d+\?confirmed=1/);
    await expect(page.getByRole("dialog", { name: "Panier" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Merci — commande confirmée" })).toBeInViewport();
  });

  test("sheet: locks page scroll, closes on Escape/backdrop/back button, restores focus", async ({ page, admin }) => {
    const p = await admin.product();
    await seedCart(page, p.variants[0].id);
    await gotoStore(page, "/products");
    await page.mouse.wheel(0, 600);
    const cartBtn = page.getByRole("button", { name: "Panier", exact: true });
    await cartBtn.click();
    const sheet = page.getByRole("dialog", { name: "Panier" });
    await expect(sheet).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await cartBtn.click();
    await expect(sheet).toBeVisible();
    await page.mouse.click(200, 40); // backdrop
    await expect(sheet).toHaveCount(0);
  });

  test("resizing from phone to desktop with the cart open keeps a usable sheet", async ({ page, admin }) => {
    const p = await admin.product();
    await seedCart(page, p.variants[0].id);
    await gotoStore(page, "/");
    await page.getByRole("button", { name: "Panier", exact: true }).click();
    await page.getByRole("dialog", { name: "Panier" }).getByRole("button", { name: "Voir le panier" }).click();
    await page.setViewportSize({ width: 1280, height: 800 });
    const sheet = page.getByRole("dialog", { name: "Panier" });
    await expect(sheet.getByRole("link", { name: "Voir le panier" })).toBeVisible();
    const box = (await sheet.locator("> div").last().boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(440); // side panel, not a stretched bottom sheet
    await sheet.getByRole("button", { name: "Fermer" }).click();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("touch ergonomics & mobile browser quirks", () => {
  test("text inputs are ≥16px on touch screens (no iOS focus zoom) and the search field has no dark focus rectangle", async ({ page, admin }) => {
    const p = await admin.product();
    await seedCart(page, p.variants[0].id);
    const sizes: string[] = [];
    for (const url of ["/login", "/register", "/forgot-password", "/cart"]) {
      await gotoStore(page, url);
      if (url === "/cart") {
        await page.getByRole("button", { name: "Panier", exact: true }).click();
        await page.getByRole("dialog", { name: "Panier" }).getByRole("button", { name: "Voir le panier" }).click();
      }
      for (const el of await page.locator("input:not([type=checkbox]):not([type=hidden]):visible").all()) {
        const fs = await el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
        if (fs < 16) sizes.push(`${url} ${await el.getAttribute("name") ?? await el.getAttribute("aria-label")}: ${fs}px`);
      }
      if (url === "/cart") await page.keyboard.press("Escape");
    }
    expect(sizes, "inputs below 16px zoom the page on iOS").toEqual([]);

    await gotoStore(page, "/");
    await page.getByRole("button", { name: "Rechercher" }).click();
    const search = page.getByRole("combobox", { name: "Rechercher" });
    await expect(search).toBeFocused();
    const style = await search.evaluate((e) => {
      const s = getComputedStyle(e);
      return { outline: s.outlineStyle === "none" || parseFloat(s.outlineWidth) === 0, fontSize: parseFloat(s.fontSize), appearance: s.appearance };
    });
    expect(style).toEqual({ outline: true, fontSize: 16, appearance: "none" });
    await page.keyboard.press("Tab"); // keyboard focus too
    await page.keyboard.press("Shift+Tab");
    expect(await search.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("none");
  });

  test("primary touch targets are at least 40×40 px", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 2000, stock: 5 }] });
    await seedCart(page, p.variants[0].id, 2);
    const small: string[] = [];
    const check = async (label: string, loc: ReturnType<Page["locator"]>) => {
      for (const el of await loc.all()) {
        if (!(await el.isVisible())) continue;
        const b = (await el.boundingBox())!;
        if (b.width < 40 || b.height < 40) small.push(`${label}: ${Math.round(b.width)}×${Math.round(b.height)}`);
      }
    };
    await gotoStore(page, "/");
    await check("dock", page.locator("nav[aria-label], div").filter({ has: page.getByRole("link", { name: "Accueil" }) }).last().getByRole("link"));
    await check("header search", page.getByRole("button", { name: "Rechercher" }));
    await check("locale toggle", page.getByRole("group", { name: "Langue" }).getByRole("button"));
    await page.getByRole("button", { name: "Panier", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Panier" });
    await check("sheet close", sheet.getByRole("button", { name: "Fermer" }));
    await check("sheet remove line", sheet.getByRole("button", { name: /^Retirer / }));
    await check("sheet stepper", sheet.getByRole("button", { name: /la quantité/ }));
    await page.keyboard.press("Escape");
    await gotoStore(page, `/products/${p.slug}`);
    await check("product stepper", page.getByRole("button", { name: /la quantité/ }));
    await check("variant chip", page.getByRole("radio"));
    expect(small, "touch targets smaller than 40px").toEqual([]);
  });

  test("the sticky header stays put while scrolling; the dock never hides the footer or page actions", async ({ page }) => {
    await gotoStore(page, "/products");
    await page.mouse.wheel(0, 2500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    const top = await page.locator("header").first().evaluate((e) => e.getBoundingClientRect().top);
    expect(top).toBe(0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectNotCovered(page, "footer a[href]", "last footer link");
  });

  test("search on mobile: opens under the header, suggestions fit the screen, closes on navigation", async ({ page }) => {
    await gotoStore(page, "/");
    await page.getByRole("button", { name: "Rechercher" }).click();
    const search = page.getByRole("combobox", { name: "Rechercher" });
    await search.fill("cam");
    const list = page.getByRole("listbox", { name: /résultats/ });
    await expect(list.getByRole("option").first()).toBeVisible();
    const box = (await list.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    await list.getByRole("option").first().click();
    await expect(page).toHaveURL(/\/products/);
    await expect(search).toHaveCount(0);
  });
});

test.describe("RTL / LTR", () => {
  test("switching language mid-session flips direction, keeps the cart and the page, mirrors the sheet", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 2400, stock: 5 }] });
    await seedCart(page, p.variants[0].id);
    await gotoStore(page, `/products/${p.slug}`);
    await page.getByRole("group", { name: "Langue" }).first().getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page).toHaveURL(new RegExp(p.slug));
    await expect(page.getByRole("button", { name: "أضف إلى السلة", exact: true })).toBeVisible();
    // prices and phone numbers stay LTR inside RTL text
    expect(await page.locator("h1").getAttribute("dir")).toBe("ltr");
    await expectNoHorizontalOverflow(page, "ar product");
    // persists across reload and navigation (page transitions land on-screen in RTL)
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByRole("link", { name: /^(الرئيسية|Accueil)$/ }).first().click();
    await expect(page).toHaveURL(/\/$/);
    const main = (await page.locator("main").boundingBox())!;
    expect(main.x).toBeGreaterThanOrEqual(-1);
    expect(main.x).toBeLessThanOrEqual(1);
    const count = await pageApi<{ cart: { count: number } }>(page, "GET", "/cart");
    expect(count.json.cart.count).toBe(1);
    await page.getByRole("group", { name: /اللغة|Langue/ }).first().getByRole("button", { name: "FR" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("Arabic checkout: labels, validation messages and the order confirmation are in Arabic", async ({ page, admin }) => {
    await setLocale(page, "ar");
    const p = await admin.product({ variants: [{ price: 2000, stock: 5 }] });
    await seedCart(page, p.variants[0].id);
    await gotoStore(page, "/");
    await page.getByRole("button", { name: "السلة", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: /عرض السلة/ }).click();
    await sheet.locator("#sheet-checkout button[type=submit]").click();
    await expect(sheet.locator("#sheet-checkout [role=alert]")).not.toHaveText(/Vérifiez/);
    await expect(sheet.locator("#sheet-checkout [role=alert]")).toBeVisible();
    // phone/e-mail fields stay LTR for typing digits
    expect(await sheet.locator("input[name=phone]").getAttribute("dir")).toBe("ltr");
    await expectNoHorizontalOverflow(page, "ar sheet");
  });
});

test.describe("failure & recovery on a flaky mobile network", () => {
  test("offline: adding to the cart fails visibly and works again once back online", async ({ page, context, admin }) => {
    const p = await admin.product({ variants: [{ price: 1300, stock: 9 }] });
    await gotoStore(page, `/products/${p.slug}`);
    await context.setOffline(true);
    await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
    await expect(toastText(page, "Action impossible pour le moment")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter au panier", exact: true })).toBeEnabled();
    await context.setOffline(false);
    await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
    await expect(toastText(page, "Ajouté au panier")).toBeVisible();
    expect((await pageApi<{ cart: { count: number } }>(page, "GET", "/cart")).json.cart.count).toBe(1);
  });

  test("offline promo apply says the action failed — not that the code is invalid", async ({ page, context, admin }) => {
    const p = await admin.product();
    await seedCart(page, p.variants[0].id);
    await gotoStore(page, "/");
    await page.getByRole("button", { name: "Panier", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Voir le panier" }).click();
    await context.setOffline(true);
    await page.getByRole("textbox", { name: "Entrez votre code" }).fill("DRIVE10");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page.getByText("Action impossible pour le moment. Réessayez.").first()).toBeVisible();
    await expect(page.getByText("Code invalide")).toHaveCount(0);
    await context.setOffline(false);
  });

  test("checkout during a server outage keeps the form, then succeeds on retry without a duplicate order", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 1700, stock: 9 }] });
    await seedCart(page, p.variants[0].id);
    await gotoStore(page, "/");
    await page.getByRole("button", { name: "Panier", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Voir le panier" }).click();
    const form = sheet.locator("#sheet-checkout");
    const tel = `06${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    await fillCheckout(form, { phone: tel });
    // the request reaches nobody (timeout / dropped connection)
    await page.route("**/api/v1/orders", (r) => r.abort("timedout"));
    await form.getByRole("button", { name: /Confirmer la commande/ }).click();
    await expect(form.getByRole("alert")).toHaveText("Action impossible pour le moment. Réessayez.");
    await expect(form.locator("input[name=phone]")).toHaveValue(tel);
    await page.unroute("**/api/v1/orders");
    await form.getByRole("button", { name: /Confirmer la commande/ }).click();
    await expect(page).toHaveURL(/\/order\/HT-\d+/);
    expect((await admin.ordersFor(tel)).total).toBe(1);
  });

  test("slow session bootstrap shows skeletons, not an empty cart or a sign-in redirect", async ({ page }) => {
    await registerVia(page.context().request);
    await page.route("**/api/v1/auth/session", async (r) => {
      await new Promise((res) => setTimeout(res, 1500));
      await r.continue();
    });
    await page.goto("/profile");
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("a broken product image doesn't break the card layout", async ({ page }) => {
    await page.route(/\/_next\/image|\/products\/.*\.(jpg|png|webp)/, (r) => r.abort());
    await gotoStore(page, "/products");
    await expectNoHorizontalOverflow(page);
    const first = page.locator(".product-grid > *").first();
    const box = (await first.boundingBox())!;
    expect(box.height).toBeGreaterThan(box.width * 0.9); // the square tile keeps its space
  });
});

test("the dock steps aside while typing (on-screen keyboard) and comes back after", async ({ page }) => {
  await gotoStore(page, "/login");
  const dock = page.locator('[style*="site-dock"]');
  await expect(dock).toBeInViewport();
  await expect(dock.getByRole("link", { name: "Accueil" })).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).focus();
  await expect(dock).not.toBeInViewport();
  // moving between fields doesn't bring it back
  await page.getByLabel("Mot de passe", { exact: true }).focus();
  await expect(dock).not.toBeInViewport();
  await page.locator("h1").click();
  await expect(dock).toBeInViewport();
  await expect(dock).not.toHaveAttribute("inert");
});

test("a viewport resize mid-navigation (keyboard closing) never raises an uncaught error", async ({ page }) => {
  // the `errors` fixture fails this test on any pageerror
  await gotoStore(page, "/products");
  for (let i = 0; i < 3; i++) {
    const link = page.locator(".product-grid > * a[href^='/products/']").nth(i);
    await Promise.all([link.click(), page.setViewportSize({ width: 412, height: i % 2 ? 915 : 520 })]);
    // the listing has an h1 too: wait for the product page itself before going back
    await expect(page).toHaveURL(/\/products\/[a-z0-9-]+$/);
    await expect(page.getByRole("radiogroup")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".product-grid")).toBeVisible();
  }
});
