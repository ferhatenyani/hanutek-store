import type { Page } from "@playwright/test";
import { test, expect, uid, gotoStore, toastText, pageApi, fillCheckout, registerVia, newShopper, BASE, type TestProduct } from "../support";

type CartJson = { cart: { lines: { variantId: string; qty: number; unitPrice: number; available: boolean; maxQty: number }[]; subtotal: number; discount: number; total: number; promo: { code: string } | null } };
const cartOf = async (page: Page) => (await pageApi<CartJson>(page, "GET", "/cart")).json.cart;
const amount = (s: string) => Number(s.replace(/[^\d]/g, ""));

async function addToCartUI(page: Page, p: TestProduct, qty = 1, variant = 0) {
  await gotoStore(page, `/products/${p.slug}`);
  if (p.variants.length > 1) await page.getByRole("radio", { name: new RegExp(p.variants[variant].label) }).click();
  for (let i = 1; i < qty; i++) await page.getByRole("button", { name: "Augmenter la quantité" }).click();
  await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
  await expect(toastText(page, "Ajouté au panier")).toBeVisible();
}

/** Places the order from /cart and returns the order number from the confirmation URL. */
async function placeOrder(page: Page, form: Parameters<typeof fillCheckout>[1] = {}) {
  await gotoStore(page, "/cart");
  await page.getByRole("button", { name: "Passer commande" }).click();
  await fillCheckout(page.locator("#checkout"), form);
  await page.getByRole("button", { name: /Confirmer la commande/ }).click();
  await expect(page).toHaveURL(/\/order\/HT-\d+\?confirmed=1/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Merci — commande confirmée" })).toBeVisible();
  return page.url().match(/HT-\d+/)![0];
}

const phone = () => `05${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;

test.describe("cart", () => {
  test("guest cart: add, change quantity, remove — server state follows and survives reload", async ({ page, admin }) => {
    const a = await admin.product({ variants: [{ price: 1800, stock: 20 }] });
    const b = await admin.product({ variants: [{ price: 2600, stock: 20 }] });
    await addToCartUI(page, a);
    await addToCartUI(page, b, 2);

    await gotoStore(page, "/cart");
    await expect(page.getByRole("heading", { name: /Panier/ })).toContainText("(3)");
    const lineA = page.locator("li").filter({ has: page.getByRole("link", { name: a.name }) });
    await lineA.getByRole("button", { name: "Augmenter la quantité" }).click();
    await lineA.getByRole("button", { name: "Augmenter la quantité" }).click();
    await expect(lineA.getByText(/5\s?400/)).toBeVisible(); // optimistic
    await expect.poll(async () => (await cartOf(page)).lines.find((l) => l.variantId === a.variants[0].id)?.qty).toBe(3);
    await page.getByRole("button", { name: `Retirer ${b.name}` }).click();
    await expect.poll(async () => (await cartOf(page)).lines.length).toBe(1);

    await page.reload();
    await expect(page.getByRole("heading", { name: /Panier/ })).toContainText("(3)");
    const cart = await cartOf(page);
    expect(cart).toMatchObject({ subtotal: 5400, total: 5400 });
  });

  test("rapid clicks on the stepper settle on the last value (no flicker back, one final write)", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 1000, stock: 30 }] });
    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    let patches = 0;
    page.on("request", (r) => r.method() === "PATCH" && r.url().includes("/cart/items/") && patches++);
    const plus = page.getByRole("button", { name: "Augmenter la quantité" });
    for (let i = 0; i < 6; i++) await plus.click({ delay: 0 });
    await expect(page.locator("li").getByText("7", { exact: true })).toBeVisible();
    await expect.poll(async () => (await cartOf(page)).lines[0].qty).toBe(7);
    expect(patches, "debounced quantity writes").toBeLessThanOrEqual(2);
    // the stepper caps at the per-line maximum (10)
    for (let i = 0; i < 5; i++) if (await plus.isEnabled()) await plus.click();
    await expect(plus).toBeDisabled();
    await expect.poll(async () => (await cartOf(page)).lines[0].qty).toBe(10);
  });

  test("guest cart merges into the account on sign-in (quantities summed, capped by stock)", async ({ page, browser, admin }) => {
    const p = await admin.product({ variants: [{ price: 1500, stock: 4 }] });
    // the account already has 2 in its cart from another device
    const other = await newShopper(browser, page);
    const c = await registerVia(other.context.request);
    await other.context.request.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty: 2 }, headers: { origin: BASE } });
    await other.context.close();

    await addToCartUI(page, p, 3);
    await gotoStore(page, "/login?next=%2Fcart");
    await page.getByLabel("E-mail", { exact: true }).fill(c.email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(c.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    const cart = await cartOf(page);
    expect(cart.lines).toEqual([expect.objectContaining({ variantId: p.variants[0].id, qty: 4 })]); // 2 + 3, capped at stock 4
    // the guest cart cookie is gone after the merge
    expect((await page.context().cookies()).some((ck) => ck.name === "__Host-ht_cart")).toBe(false);
  });

  test("the cart persists across logout/login and sessions", async ({ page, admin }) => {
    const p = await admin.product();
    const c = await registerVia(page.context().request);
    await addToCartUI(page, p, 2);
    await page.request.post("/api/v1/auth/logout", { headers: { origin: BASE } });
    await gotoStore(page, "/cart");
    await expect(page.getByText("Votre panier est vide")).toBeVisible();
    await page.request.post("/api/v1/auth/login", { data: { email: c.email, password: c.password }, headers: { origin: BASE } });
    await gotoStore(page, "/cart");
    await expect(page.getByRole("heading", { name: /Panier/ })).toContainText("(2)");
  });
});

test.describe("promo codes", () => {
  async function applyCode(page: Page, code: string) {
    const input = page.getByRole("textbox", { name: "Entrez votre code" });
    await input.fill(code);
    await page.getByRole("button", { name: "Appliquer" }).click();
  }

  test("valid percent code: exact discount from the server, removal restores the total", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 12345, stock: 10 }] });
    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    await applyCode(page, " drive10 "); // trimmed, case-insensitive
    await expect(toastText(page, "DRIVE10 · Code appliqué")).toBeVisible();
    const cart = await cartOf(page);
    expect(cart).toMatchObject({ subtotal: 12345, discount: 1235, total: 11110, promo: { code: "DRIVE10" } });
    await expect(page.getByText(/Réduction \(DRIVE10\)/)).toBeVisible();
    await page.getByRole("button", { name: /^Retirer [A-Z0-9-]+$/ }).click();
    await expect.poll(async () => (await cartOf(page)).total).toBe(12345);
  });

  test("percent codes respect their max discount; fixed codes never exceed the subtotal", async ({ page, admin }) => {
    const capped = await admin.promo({ code: uid("CAP").toUpperCase(), type: "percent", value: 50, maxDiscount: 2000 });
    const fixed = await admin.promo({ code: uid("FIX").toUpperCase(), type: "fixed", value: 99999 });
    const p = await admin.product({ variants: [{ price: 10000, stock: 10 }] });
    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    await applyCode(page, capped.code);
    await expect.poll(async () => (await cartOf(page)).discount).toBe(2000);
    // applying another code replaces the first (one code per order)
    await page.getByRole("button", { name: /^Retirer [A-Z0-9-]+$/ }).click();
    await applyCode(page, fixed.code);
    await expect.poll(async () => cartOf(page)).toMatchObject({ discount: 10000, total: 0, promo: { code: fixed.code } });
  });

  test("ineligible codes explain why: unknown, expired, paused, not started, used up, already used", async ({ page, admin }) => {
    const soon = await admin.promo({ code: uid("SOON").toUpperCase(), type: "percent", value: 10, startsAt: new Date(Date.now() + 7 * 864e5).toISOString() });
    const once = await admin.promo({ code: uid("ONCE").toUpperCase(), type: "fixed", value: 100, usageLimit: 1 });
    const p = await admin.product({ variants: [{ price: 6000, stock: 50 }] });

    // someone else uses up the single-use code
    const other = await newShopper(page.context().browser()!, page);
    await addToCartUI(other.page, p);
    await gotoStore(other.page, "/cart");
    await applyCode(other.page, once.code);
    await expect.poll(async () => (await cartOf(other.page)).promo?.code).toBe(once.code);
    await placeOrder(other.page, { phone: phone() });
    await other.context.close();
    expect((await admin.promoByCode(once.code))!.usedCount).toBe(1);

    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    const error = page.locator("form[aria-label='Un code promo ?'] [role=alert]");
    const cases: [string, RegExp][] = [
      ["NOPE-NOT-A-CODE", /Code invalide/],
      ["SUMMER15", /expiré/],
      ["FLASH20", /n’est plus actif/],
      [soon.code, /pas encore actif/],
      [once.code, /limite d’utilisation/],
    ];
    for (const [code, message] of cases) {
      await applyCode(page, code);
      await expect(error, code).toHaveText(message);
      expect((await cartOf(page)).promo).toBeNull();
    }
  });

  test("minimum order: refused below it; if the cart later drops below, the shopper is warned and checkout explains it", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 3000, stock: 20 }] });
    const c = await registerVia(page.context().request);
    void c;
    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    await applyCode(page, "WELCOME500"); // min 5 000 DA
    await expect(page.getByText("Montant minimum non atteint pour ce code")).toBeVisible();

    const line = page.locator("li").filter({ has: page.getByRole("link", { name: p.name }) });
    await line.getByRole("button", { name: "Augmenter la quantité" }).click();
    await expect.poll(async () => (await cartOf(page)).subtotal).toBe(6000);
    await applyCode(page, "WELCOME500");
    await expect.poll(async () => cartOf(page)).toMatchObject({ discount: 500, total: 5500 });

    // back under the minimum: the chip must not claim a discount the total no longer has
    await line.getByRole("button", { name: "Diminuer la quantité" }).click();
    await expect.poll(async () => (await cartOf(page)).discount).toBe(0);
    await expect(page.getByText(/Ce code s’applique dès 5\s?000/)).toBeVisible();
    await expect(page.getByText(/Réduction \(WELCOME500\)/)).toHaveCount(0);
  });

  test("per-customer limit: the same account can't redeem a one-per-customer code twice", async ({ page, admin }) => {
    const code = uid("PERUSER").toUpperCase();
    await admin.promo({ code, type: "fixed", value: 300, perUserLimit: 1 });
    const p = await admin.product({ variants: [{ price: 4000, stock: 20 }] });
    await registerVia(page.context().request);
    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    await applyCode(page, code);
    await expect.poll(async () => (await cartOf(page)).discount).toBe(300);
    await placeOrder(page, { phone: phone() });

    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    await applyCode(page, code);
    await expect(page.locator("form[aria-label='Un code promo ?'] [role=alert]")).toHaveText(/déjà utilisé/);
  });

  test("a guest can't dodge a per-customer limit by checking out again with the same phone number", async ({ page, admin, browser }) => {
    const code = uid("PHONE").toUpperCase();
    await admin.promo({ code, type: "fixed", value: 400, perUserLimit: 1 });
    const p = await admin.product({ variants: [{ price: 4000, stock: 20 }] });
    const tel = phone();
    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    await applyCode(page, code);
    await expect.poll(async () => (await cartOf(page)).discount).toBe(400);
    await placeOrder(page, { phone: tel });

    const second = await newShopper(browser, page);
    await addToCartUI(second.page, p);
    await gotoStore(second.page, "/cart");
    await applyCode(second.page, code); // eligible as an anonymous cart…
    await expect.poll(async () => (await cartOf(second.page)).discount).toBe(400);
    await second.page.getByRole("button", { name: "Passer commande" }).click();
    await fillCheckout(second.page.locator("#checkout"), { phone: tel.replace(/^0/, "+213 ") }); // …but the phone (any format) already used it
    await second.page.getByRole("button", { name: /Confirmer la commande/ }).click();
    await expect(second.page.locator("#checkout").getByRole("alert")).toHaveText(/code promo n’est plus valable/);
    await second.context.close();
  });
});

test.describe("checkout & orders", () => {
  test("guest checkout: server-priced order, stock and ledger updated, confirmation survives reload, private to this browser", async ({ page, admin, browser }) => {
    const p = await admin.product({ variants: [{ price: 2750, stock: 7, label: "Standard" }] });
    const tel = phone();
    await addToCartUI(page, p, 2);

    // validation first: nothing filled in
    await gotoStore(page, "/cart");
    await page.getByRole("button", { name: "Passer commande" }).click();
    await page.getByRole("button", { name: /Confirmer la commande/ }).click();
    await expect(page.locator("#checkout").getByRole("alert")).toHaveText("Vérifiez les champs en surbrillance");
    await expect(page.getByText("Ce champ est requis").first()).toBeVisible();
    await page.locator("#checkout input[name=phone]").fill("12345");
    await page.getByRole("button", { name: /Confirmer la commande/ }).click();
    await expect(page.getByText("Numéro invalide")).toBeVisible();

    const number = await placeOrder(page, { phone: `+213 ${tel.slice(1)}`, email: "guest.buyer@example.dz", postalCode: "16000" });
    await expect(page.getByText(number)).toBeVisible();
    await expect(page.getByText("Espèces à la livraison")).toBeVisible();

    // backend state
    const order = await admin.order(number);
    expect(order).toMatchObject({ status: "pending", subtotal: 5500, discount: 0, total: 5500, paymentStatus: "unpaid", userId: null, address: expect.objectContaining({ phone: tel, wilaya: "16", postalCode: "16000", email: "guest.buyer@example.dz" }) });
    expect(order.items).toEqual([expect.objectContaining({ variantId: p.variants[0].id, qty: 2, unitPrice: 2750 })]);
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(5);
    expect((await admin.movements(p.variants[0].id))[0]).toMatchObject({ delta: -2, stockAfter: 5, reason: "order" });
    expect((await cartOf(page)).lines).toEqual([]);
    await expect(page.getByRole("button", { name: /Ouvrir le panier \(0\)/ })).toBeVisible();

    // refresh the confirmation page
    await page.reload();
    await expect(page.getByText(number)).toBeVisible();

    // another browser can't see it without the key; with the shared link it can, and the key leaves the URL
    const stranger = await newShopper(browser, page);
    await gotoStore(stranger.page, `/order/${number}`);
    await expect(stranger.page.getByRole("heading", { name: "Commande introuvable" })).toBeVisible();
    const key = await page.evaluate((n) => JSON.parse(localStorage.getItem("hanutek-guest-orders-v1")!)[n], number);
    await gotoStore(stranger.page, `/order/${number}?key=${encodeURIComponent(key)}`);
    await expect(stranger.page.getByText(number)).toBeVisible();
    await expect(stranger.page).toHaveURL(new RegExp(`/order/${number}$`));
    await stranger.context.close();
  });

  test("signed-in checkout: prefilled from the profile, saves the address, shows in history, cancellable until packed", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 4100, stock: 10 }] });
    const c = await registerVia(page.context().request, { name: "Walid Cherif" });
    const tel = phone();
    await addToCartUI(page, p, 3);
    await gotoStore(page, "/cart");
    await page.getByRole("button", { name: "Passer commande" }).click();
    const form = page.locator("#checkout");
    await expect(form.locator("input[name=name]")).toHaveValue("Walid Cherif");
    await expect(form.locator("input[name=email]")).toHaveValue(c.email);
    await expect(form.getByText("Commande en tant qu’invité.")).toHaveCount(0);
    await expect(form.getByLabel("Enregistrer comme adresse par défaut")).toBeChecked();
    await fillCheckout(form, { name: undefined, phone: tel, address: "7 Boulevard Mohamed V", commune: "Blida", wilaya: "09" });
    await form.getByRole("button", { name: /Confirmer la commande · 12\s?300/ }).click();
    await expect(page).toHaveURL(/\/order\/HT-\d+\?confirmed=1/);
    const number = page.url().match(/HT-\d+/)![0];

    // the default address was saved and prefills the next checkout
    const me = await pageApi<{ user: { phone: string; defaultAddress: { line1: string; wilaya: string } } }>(page, "GET", "/me");
    expect(me.json.user).toMatchObject({ phone: tel, defaultAddress: { line1: "7 Boulevard Mohamed V", wilaya: "09" } });

    await gotoStore(page, "/profile");
    const card = page.locator("article").filter({ hasText: number });
    await expect(card).toContainText("En traitement");
    await expect(card).toContainText(/12\s?300/);
    await card.getByRole("link", { name: "Suivi complet" }).click();
    await expect(page.getByRole("heading", { name: "Détails de la commande" })).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Annuler la commande" }).click();
    await expect(toastText(page, "Commande annulée")).toBeVisible();
    await expect(page.getByText(/Commande annulée le/)).toBeVisible();
    expect((await admin.order(number)).status).toBe("cancelled");
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(10); // restocked
    expect((await admin.movements(p.variants[0].id))[0]).toMatchObject({ delta: 3, reason: "cancel" });
  });

  test("orders can't be cancelled by the customer once packed; staff transitions follow the business rules", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 2000, stock: 10 }] });
    await registerVia(page.context().request);
    await addToCartUI(page, p);
    const number = await placeOrder(page, { phone: phone() });
    await admin.status(number, "confirmed");
    await admin.status(number, "packed");
    await page.reload();
    await expect(page.getByRole("button", { name: "Annuler la commande" })).toHaveCount(0);
    const res = await pageApi<{ error: { code: string } }>(page, "POST", `/orders/${number}/cancel`);
    expect(res.json.error.code).toBe("ORDER_NOT_CANCELLABLE");

    // invalid jump (packed → delivered) is refused; the valid path marks it paid on delivery
    await expect(admin.status(number, "delivered")).rejects.toThrow(/INVALID_TRANSITION/);
    await admin.status(number, "shipped", { carrier: "Yalidine", trackingNumber: "YAL-778899" });
    await page.reload();
    await expect(page.getByText("YAL-778899")).toBeVisible();
    await expect(page.getByText("Transporteur : Yalidine")).toBeVisible();
    await admin.status(number, "delivered");
    expect((await admin.order(number)).paymentStatus).toBe("paid");
    await admin.status(number, "returned");
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(10); // a return restocks
    expect((await admin.order(number)).paymentStatus).toBe("refunded");
  });

  test("double-click / repeated submit creates exactly one order", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 1900, stock: 10 }] });
    const tel = phone();
    await addToCartUI(page, p);
    await gotoStore(page, "/cart");
    await page.getByRole("button", { name: "Passer commande" }).click();
    await fillCheckout(page.locator("#checkout"), { phone: tel });
    const submit = page.getByRole("button", { name: /Confirmer la commande/ });
    let posts = 0;
    page.on("request", (r) => r.method() === "POST" && r.url().endsWith("/api/v1/orders") && posts++);
    await submit.dblclick();
    await page.keyboard.press("Enter").catch(() => undefined);
    await expect(page).toHaveURL(/\/order\/HT-\d+/);
    expect(posts).toBe(1);
    expect((await admin.ordersFor(tel)).total).toBe(1);
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(9);
  });

  test("a network retry of the same checkout replays the original order (idempotency key)", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 1500, stock: 10 }] });
    await registerVia(page.context().request);
    await gotoStore(page, "/");
    await pageApi(page, "POST", "/cart/items", { variantId: p.variants[0].id, qty: 1 });
    const body = { idempotencyKey: crypto.randomUUID(), contact: { name: "Retry Test", phone: phone() }, address: { line1: "1 Rue", commune: "Alger", wilaya: "16" }, locale: "fr" };
    const first = await pageApi<{ order: { number: string } }>(page, "POST", "/orders", body);
    const again = await pageApi<{ order: { number: string } }>(page, "POST", "/orders", body);
    expect(first.status).toBe(201);
    expect(again.json.order.number).toBe(first.json.order.number);
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(9);
  });

  test("can't buy more than is in stock; a stock drop after adding blocks checkout until the cart is fixed", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 2200, stock: 5 }] });
    // the API caps quantities at the stock level
    await gotoStore(page, "/");
    const add = await pageApi<CartJson>(page, "POST", "/cart/items", { variantId: p.variants[0].id, qty: 9 });
    expect(add.json.cart.lines[0].qty).toBe(5);

    // a staff stock correction leaves only 2 units
    await admin.setStock(p.variants[0].id, 2);
    await gotoStore(page, "/cart");
    await expect(page.getByText("Plus que 2 en stock — ajustez la quantité")).toBeVisible();
    await page.getByRole("button", { name: "Passer commande" }).click();
    await fillCheckout(page.locator("#checkout"), { phone: phone() });
    await expect(page.getByRole("button", { name: /Confirmer la commande/ })).toBeDisabled();
    await expect(page.locator("#checkout").getByText(/Le stock a changé/)).toBeVisible();

    // fixing the quantity unblocks it and the order takes exactly what is left
    const line = page.locator("li").filter({ has: page.getByRole("link", { name: p.name }) });
    for (let i = 0; i < 3; i++) await line.getByRole("button", { name: "Diminuer la quantité" }).click();
    await expect.poll(async () => (await cartOf(page)).lines[0].qty).toBe(2);
    await expect(page.getByRole("button", { name: /Confirmer la commande/ })).toBeEnabled();
    await page.getByRole("button", { name: /Confirmer la commande/ }).click();
    await expect(page).toHaveURL(/\/order\/HT-\d+/);
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(0);
  });

  test("stock sells out between page load and submit: clear message, no order, no negative stock", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 3300, stock: 3 }] });
    await addToCartUI(page, p, 3);
    await gotoStore(page, "/cart");
    await page.getByRole("button", { name: "Passer commande" }).click();
    await fillCheckout(page.locator("#checkout"), { phone: phone() });
    await admin.setStock(p.variants[0].id, 1); // sold elsewhere meanwhile
    await page.getByRole("button", { name: /Confirmer la commande/ }).click();
    await expect(page.locator("#checkout").getByRole("alert")).toHaveText(/Le stock a changé/);
    await expect(page.getByText("Plus que 1 en stock — ajustez la quantité")).toBeVisible();
    await expect(page).toHaveURL(/\/cart/);
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(1);
  });

  test("two shoppers race for the last unit: exactly one order, stock ends at 0, the other is told", async ({ page, browser, admin }) => {
    const p = await admin.product({ variants: [{ price: 8900, stock: 1 }] });
    const a = page;
    const b = (await newShopper(browser, page)).page;
    for (const s of [a, b]) {
      await addToCartUI(s, p);
      await gotoStore(s, "/cart");
      await s.getByRole("button", { name: "Passer commande" }).click();
      await fillCheckout(s.locator("#checkout"), { phone: phone() });
    }
    await Promise.all([a, b].map((s) => s.getByRole("button", { name: /Confirmer la commande/ }).click()));
    const outcome = await Promise.all(
      [a, b].map((s) =>
        Promise.race([
          s.waitForURL(/\/order\/HT-\d+/, { timeout: 15_000 }).then(() => "won"),
          s.locator("#checkout").getByRole("alert").filter({ hasText: /Le stock a changé/ }).waitFor({ timeout: 15_000 }).then(() => "lost"),
        ]),
      ),
    );
    expect(outcome.sort()).toEqual(["lost", "won"]);
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(0);
    const orders = (await admin.movements(p.variants[0].id)).filter((m) => m.reason === "order");
    expect(orders).toHaveLength(1);
    await b.context().close();
  });

  test("buy now goes straight to the checkout form with the item in the cart", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 2900, stock: 5 }] });
    await gotoStore(page, `/products/${p.slug}`);
    await page.getByRole("button", { name: /Commander maintenant/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator("#checkout input[name=name]")).toBeInViewport();
    expect((await cartOf(page)).lines).toEqual([expect.objectContaining({ variantId: p.variants[0].id, qty: 1 })]);
  });

  test("order totals on the confirmation page match the database to the dinar (discount + shipping fee)", async ({ page, admin }) => {
    const p = await admin.product({ variants: [{ price: 7777, stock: 10 }] });
    await addToCartUI(page, p, 2);
    await gotoStore(page, "/cart");
    await page.getByRole("textbox", { name: "Entrez votre code" }).fill("DRIVE10");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect.poll(async () => (await cartOf(page)).discount).toBe(1555);
    const number = await placeOrder(page, { phone: phone() });
    await admin.call("PATCH", `/orders/${number}`, { shippingFee: 600 });
    await page.reload();
    const order = await admin.order(number);
    expect(order).toMatchObject({ subtotal: 15554, discount: 1555, shippingFee: 600, total: 14599, promoCode: "DRIVE10" });
    const summary = page.locator("section[aria-label='Articles'] dl");
    await expect(summary).toContainText(/15\s?554/);
    await expect(summary).toContainText(/1\s?555/);
    await expect(summary).toContainText(/600/);
    expect(amount((await summary.locator("div").last().locator("dd").textContent())!)).toBe(14599);
  });
});
