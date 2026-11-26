import { test, expect, uid, gotoStore, toastText, pageApi } from "../support";

/** Parses "12 500 DA" / "12 500 د.ج" style prices into numbers. */
const amount = (s: string) => Number(s.replace(/[^\d]/g, ""));

test.describe("catalogue: browse, search, filter, sort, paginate", () => {
  test("listing shows exactly what the API returns (count, order, prices)", async ({ page }) => {
    await gotoStore(page, "/products");
    const api = await pageApi<{ total: number; items: { name: string; price: number }[] }>(page, "GET", "/products?pageSize=24");
    await expect(page.getByText(`${api.json.total} produits`)).toBeVisible();
    const cards = page.locator(".product-grid > *");
    await expect(cards).toHaveCount(Math.min(24, api.json.total));
    const firstNames = await cards.locator("h3").allTextContents();
    expect(firstNames.slice(0, 6)).toEqual(api.json.items.slice(0, 6).map((p) => p.name));
  });

  test("category, sale and sort filters live in the URL, survive reload and back/forward", async ({ page }) => {
    await gotoStore(page, "/products");
    await page.getByRole("link", { name: "Énergie", exact: true }).click();
    await expect(page).toHaveURL(/category=power/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Énergie & démarrage");
    const powerCount = amount((await page.getByText(/^\d+ produits$/).textContent())!);
    const api = await pageApi<{ total: number }>(page, "GET", "/products?category=power");
    expect(powerCount).toBe(api.json.total);

    await page.getByRole("button", { name: "Trier par" }).click();
    await page.getByRole("option", { name: "Prix croissant" }).click();
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(page.locator(".product-grid")).not.toHaveAttribute("aria-busy", "true");
    const prices = (await page.locator(".product-grid > * .num.font-display:visible").allTextContents()).map(amount).filter(Boolean);
    expect(prices.length).toBeGreaterThan(1);
    expect(prices, "displayed prices must be non-decreasing under 'Prix croissant'").toEqual([...prices].sort((a, b) => a - b));

    await page.reload();
    await expect(page.getByRole("button", { name: "Trier par" })).toContainText("Prix croissant");
    // sort refines the current entry (replace); category is a navigation (push)
    await page.goBack();
    await expect(page).toHaveURL(/\/products$/);
    await page.goForward();
    await expect(page).toHaveURL(/category=power&sort=price-asc/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Énergie & démarrage");
    // "Tout" clears the category but keeps the chosen sort
    await page.getByRole("link", { name: "Tout", exact: true }).click();
    await expect(page).toHaveURL(/\/products\?sort=price-asc$/);
  });

  test("price sort follows the price shown on the card even when the default option is not the cheapest", async ({ page, admin }) => {
    const tag = uid("Zsort");
    // default option (position 0) 9 000 DA, a cheaper second option at 1 000 DA
    await admin.product({ name: `${tag} Premium`, category: "care", variants: [{ price: 9000, stock: 5 }, { price: 1000, stock: 5 }] });
    await admin.product({ name: `${tag} Basic`, category: "care", variants: [{ price: 4000, stock: 5 }] });
    await gotoStore(page, `/products?q=${tag}&sort=price-asc`);
    const names = await page.locator(".product-grid > * h3").allTextContents();
    const prices = (await page.locator(".product-grid > * .num.font-display:visible").allTextContents()).map(amount);
    expect(names).toEqual([`${tag} Basic`, `${tag} Premium`]);
    expect(prices).toEqual([4000, 9000]);
  });

  test("search: suggestions as you type, keyboard selection, full results page, recent searches", async ({ page }) => {
    await gotoStore(page, "/");
    const search = page.getByRole("combobox", { name: "Rechercher" });
    await search.click();
    await expect(page.getByText("Recherches populaires")).toBeVisible();
    await search.fill("cam");
    const results = page.getByRole("listbox", { name: /résultats/ });
    await expect(results.getByRole("option").first()).toBeVisible();
    await search.press("ArrowDown");
    await expect(results.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await search.press("ArrowUp");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/products\?q=cam/);
    await expect(page.locator("main").getByText("cam", { exact: true })).toBeVisible(); // active search chip
    const total = amount((await page.getByText(/^\d+ produits$/).textContent())!);
    expect(total).toBeGreaterThan(0);

    await search.click();
    await search.fill("");
    await expect(page.getByText("Recherches récentes")).toBeVisible();
    await expect(page.getByRole("button", { name: "cam", exact: true })).toBeVisible();
  });

  test("a search with no match shows a helpful empty state with a way out", async ({ page }) => {
    await gotoStore(page, "/");
    const search = page.getByRole("combobox", { name: "Rechercher" });
    await search.fill("zzqxnothing");
    await expect(page.getByText("Aucun résultat pour « zzqxnothing »")).toBeVisible();
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: "Aucun produit trouvé" })).toBeVisible();
    await page.getByRole("link", { name: "Effacer les filtres" }).last().click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test("search input is treated literally (LIKE wildcards and quotes)", async ({ page }) => {
    for (const q of ["%", "_", "'; drop table products; --", "\\"]) {
      const r = await page.request.get(`/api/v1/search/suggest?q=${encodeURIComponent(q)}`);
      expect(r.status(), q).toBe(200);
      const products = ((await r.json()).items as { kind: string }[]).filter((i) => i.kind === "product");
      expect(products, `"${q}" must not act as a wildcard`).toEqual([]);
    }
    await gotoStore(page, `/products?q=${encodeURIComponent("%")}`);
    await expect(page.getByRole("heading", { name: "Aucun produit trouvé" })).toBeVisible();
  });

  test("'see more' pagination appends the next page and keeps the filters", async ({ page, admin }) => {
    // guarantee > 24 products in one category
    const tag = uid("Zpage");
    for (let i = 0; i < 26; i++) await admin.product({ name: `${tag} ${String(i).padStart(2, "0")}`, category: "interior", variants: [{ price: 1000 + i, stock: 3 }] });
    await gotoStore(page, `/products?q=${tag}&sort=name`);
    await expect(page.locator(".product-grid > *")).toHaveCount(24);
    await page.getByRole("link", { name: "Voir plus" }).click();
    await expect(page.locator(".product-grid > *")).toHaveCount(26);
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/sort=name/);
    await expect(page.getByRole("link", { name: "Voir plus" })).toHaveCount(0);
  });

  test("product page: variants change price and availability; sold-out options can't be bought", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 3200, stock: 4, label: "Noir" }, { price: 3900, stock: 0, label: "Rouge" }, { price: 4500, stock: 2, label: "Carbone", compareAt: 6000 }] });
    await gotoStore(page, `/products/${p.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.name);
    await expect(page.getByRole("radio", { name: /Noir/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("main").getByText(/3\s?200/).first()).toBeVisible();

    await page.getByRole("radio", { name: /Rouge/ }).click();
    await expect(page.getByText("· Épuisé")).toBeVisible();
    await expect(page.getByRole("button", { name: "Épuisé" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Commander maintenant/ })).toBeDisabled();

    await page.getByRole("radio", { name: /Carbone/ }).click();
    await expect(page.getByText(/Économisez 1\s?500/)).toBeVisible();
    // the stepper is capped by real stock (2)
    await page.getByRole("button", { name: "Augmenter la quantité" }).click();
    await expect(page.getByRole("button", { name: "Augmenter la quantité" })).toBeDisabled();
    await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
    await expect(toastText(page, "Ajouté au panier")).toBeVisible();
    const cart = await pageApi<{ cart: { lines: { variantId: string; qty: number; unitPrice: number }[] } }>(page, "GET", "/cart");
    expect(cart.json.cart.lines).toEqual([expect.objectContaining({ variantId: p.variants[2].id, qty: 2, unitPrice: 4500 })]);
  });

  test("unknown, draft and archived products are 404 — and an archived product drops out of the listing", async ({ page, admin }) => {
    const draft = await admin.product({ status: "draft" });
    const live = await admin.product({ name: `${uid("Zarch")} Lamp` });
    for (const slug of ["does-not-exist-anywhere", draft.slug]) {
      const res = await page.goto(`/products/${slug}`);
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    }
    await gotoStore(page, `/products/${live.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(live.name);
    await admin.call("DELETE", `/products/${live.id}`);
    const res = await page.goto(`/products/${live.slug}`);
    expect(res?.status()).toBe(404);
    await gotoStore(page, `/products?q=${encodeURIComponent(live.name)}`);
    await expect(page.getByRole("heading", { name: "Aucun produit trouvé" })).toBeVisible();
  });

  test("an admin price change is visible on the storefront right away (cache invalidation)", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 5000, stock: 9 }] });
    await gotoStore(page, `/products/${p.slug}`);
    await expect(page.getByRole("button", { name: /Commander maintenant · 5\s?000/ })).toBeVisible();
    await admin.patchProduct(p.id, {
      variants: [{ id: p.variants[0].id, code: p.variants[0].code, sku: `SKU-${uid().toUpperCase()}`, price: 4200, labels: { fr: "Option 1", ar: "خيار 1" } }],
    });
    await page.reload();
    await expect(page.getByRole("button", { name: /Commander maintenant · 4\s?200/ })).toBeVisible();
  });

  test("favorites: guest favorites persist locally and merge into the account on sign-in", async ({ page, admin }) => {
    const p = await admin.product();
    await gotoStore(page, `/products?q=${encodeURIComponent(p.name)}`);
    await page.getByRole("button", { name: `Ajouter ${p.name} aux favoris` }).click();
    await gotoStore(page, "/favorites");
    await expect(page.getByRole("link", { name: p.name })).toBeVisible();
    const email = `${uid("fav.")}@example.dz`;
    await page.request.post("/api/v1/auth/register", { data: { name: "Fav Fan", email, password: "Shopper-pass-2026!", locale: "fr", acceptTerms: true }, headers: { origin: new URL(page.url()).origin } });
    await gotoStore(page, "/favorites");
    await expect(page.getByRole("link", { name: p.name })).toBeVisible();
    const server = await pageApi<{ slugs: string[] }>(page, "GET", "/me/favorites");
    expect(server.json.slugs).toContain(p.slug);
  });
});
