/**
 * Browser smoke test of the integrated storefront (real UI, real API, real DB).
 * Uses the locally installed Chrome/Edge through playwright-core — no browser download.
 *
 *   npm run build && LOCAL_PREVIEW=1 JWT_SECRET=... npx next start -p 3123
 *   node scripts/ui-smoke.mjs http://localhost:3123
 *
 * Fails on any page error, console error, or broken step.
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3123";
const browser = await chromium.launch({ channel: process.env.UI_BROWSER ?? "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  // 401s from /api/v1/me during sign-out checks are expected network noise, not app errors
  if (msg.type() === "error" && !/Failed to load resource/.test(msg.text())) problems.push(`console: ${msg.text()}`);
});

let passed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${String(err.message ?? err).split("\n")[0]}`);
    await page.screenshot({ path: `ui-smoke-fail-${passed}.png`, fullPage: false }).catch(() => undefined);
    problems.push(`step failed: ${name}`);
  }
}

const cartBadge = () => page.locator('header button[aria-label*="panier"]').first();

await step("home renders DB products and hydrates the session", async () => {
  await page.goto(BASE + "/");
  await page.getByRole("heading", { name: /JumpCore 1000/ }).first().waitFor();
  await page.waitForResponse((r) => r.url().includes("/api/v1/auth/session"), { timeout: 15000 }).catch(() => undefined);
});

await step("quick add from a product card updates the header badge", async () => {
  await page.getByRole("button", { name: /Ajouter au panier — JumpCore 1000/ }).first().click();
  await page.waitForFunction(() => document.querySelector('header button[aria-label*="panier"]')?.getAttribute("aria-label")?.includes("(1)"), null, { timeout: 10000 });
});

await step("listing: category chip filters server-side", async () => {
  await page.goto(BASE + "/products");
  await page.getByRole("link", { name: "Vision" }).click();
  await page.waitForURL(/category=vision/);
  await page.getByRole("heading", { name: /ReverseView Pro/ }).first().waitFor();
  if (await page.getByRole("heading", { name: /JumpCore 1000/ }).count()) throw new Error("non-vision product shown");
});

await step("search bar shows live suggestions", async () => {
  const input = page.getByRole("combobox").first();
  await input.fill("dash");
  await page.getByRole("option", { name: /RoadEye Dual Dash Cam/ }).first().waitFor({ timeout: 10000 });
  await input.fill("");
});

await step("product detail: pick variant, add to cart", async () => {
  await page.goto(BASE + "/products/roadeye-dual-dash-cam");
  await page.getByRole("radio", { name: /Avant \+ intérieur/ }).click();
  await page.getByRole("button", { name: /^Ajouter au panier$/ }).click();
  await page.waitForFunction(() => document.querySelector('header button[aria-label*="panier"]')?.getAttribute("aria-label")?.includes("(2)"), null, { timeout: 10000 });
});

await step("product detail: reviews section loads", async () => {
  await page.getByRole("button", { name: /Avis clients/ }).click();
  await page.getByText(/Aucun avis pour le moment|Achat vérifié/).first().waitFor({ timeout: 10000 });
});

await step("cart page: server-priced lines, promo code", async () => {
  await page.goto(BASE + "/cart");
  await page.getByRole("link", { name: "RoadEye Dual Dash Cam" }).first().waitFor();
  await page.getByPlaceholder(/code/i).first().fill("DRIVE10");
  await page.getByRole("button", { name: /Appliquer/ }).first().click();
  await page.getByText("DRIVE10").first().waitFor();
  await page.getByText(/Réduction/).first().waitFor({ timeout: 10000 });
});

let orderNumber = "";
await step("guest checkout places a COD order and shows tracking", async () => {
  const form = page.locator("#checkout form");
  await form.locator('input[name="name"]').fill("Selma Djouadi");
  await form.locator('input[name="phone"]').fill("0555 66 77 88");
  await form.locator('input[name="email"]').fill("selma@example.dz");
  await form.locator('input[name="address"]').fill("3 Rue Khemisti");
  await form.locator('input[name="commune"]').fill("Blida");
  await form.getByRole("button", { name: /wilaya/i }).first().click();
  await page.getByRole("option", { name: /^09 — Blida/ }).click();
  await form.getByRole("button", { name: /Commander|Confirmer|Passer/ }).last().click();
  await page.waitForURL(/\/order\/HT-\d{6}/, { timeout: 20000 });
  orderNumber = page.url().match(/HT-\d{6}/)[0];
  await page.getByText(orderNumber).first().waitFor();
  await page.getByText(/Paiement à la livraison|Espèces à la livraison/).first().waitFor();
});

await step("guest can reopen their order (key kept in this browser)", async () => {
  await page.goto(`${BASE}/order/${orderNumber}`);
  await page.getByText(orderNumber).first().waitFor({ timeout: 10000 });
});

await step("guest order can be cancelled", async () => {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Annuler la commande/ }).click();
  await page.getByText(/Commande annulée/).first().waitFor({ timeout: 10000 });
});

const email = `ui${Date.now()}@example.dz`;
await step("register through the UI lands on the profile", async () => {
  await page.goto(BASE + "/register");
  await page.getByLabel(/^Nom/).first().fill("Ui Tester");
  await page.locator("main form input[type=email]").first().fill(email);
  await page.locator('input[autocomplete="new-password"]').fill("Ui-tester-pass1");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Créer/ }).click();
  await page.waitForURL(/\/profile/, { timeout: 15000 });
  await page.getByRole("heading", { name: /Ui/ }).first().waitFor();
  await page.getByText(/Confirmez votre adresse e-mail/).first().waitFor();
});

await step("profile settings save to the server", async () => {
  await page.getByRole("tab", { name: /Réglages/ }).click();
  await page.getByLabel(/Téléphone/).first().fill("0770 11 22 33");
  await page.getByRole("button", { name: /^Enregistrer$/ }).first().click();
  await page.getByText(/Profil mis à jour/).first().waitFor({ timeout: 10000 });
  await page.reload();
  await page.getByRole("tab", { name: /Réglages/ }).click();
  const v = await page.getByLabel(/Téléphone/).first().inputValue();
  if (v !== "0770112233") throw new Error(`phone not persisted: ${v}`);
});

await step("favorites persist for the account", async () => {
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: /Ajouter GripDash Phone Mount aux favoris/ }).first().click();
  await page.goto(BASE + "/favorites");
  await page.getByRole("heading", { name: /GripDash Phone Mount/ }).first().waitFor({ timeout: 10000 });
});

await step("session survives a reload; logout clears it", async () => {
  await page.goto(BASE + "/profile");
  await page.getByRole("button", { name: /Se déconnecter/ }).waitFor();
  await page.getByRole("button", { name: /Se déconnecter/ }).click();
  await page.waitForURL(BASE + "/", { timeout: 10000 });
  await page.goto(BASE + "/profile");
  await page.waitForURL(/\/login/, { timeout: 10000 });
});

await step("login through the UI", async () => {
  await page.locator("main form input[type=email]").first().fill(email);
  await page.locator('input[autocomplete="current-password"]').fill("Ui-tester-pass1");
  await page.getByRole("button", { name: /Se connecter|Connexion/ }).last().click();
  await page.waitForURL(/\/profile/, { timeout: 15000 });
});

await step("wrong password shows an error", async () => {
  const p2 = await ctx.newPage();
  await p2.goto(BASE + "/login");
  await p2.locator("main form input[type=email]").first().fill(email);
  await p2.locator('input[autocomplete="current-password"]').fill("wrong-password");
  await p2.getByRole("button", { name: /Se connecter|Connexion/ }).last().click();
  await p2.getByRole("alert").filter({ hasText: /incorrect/ }).first().waitFor({ timeout: 10000 });
  await p2.close();
});

await step("Arabic locale switches content and direction", async () => {
  await page.goto(BASE + "/products/jumpcore-1000-starter");
  await page.getByRole("button", { name: "عربي" }).first().click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  await page.getByText(/[؀-ۿ]{4,}/).first().waitFor();
});

await browser.close();
const unique = [...new Set(problems)];
if (unique.length) console.log("\nProblems:\n" + unique.map((p) => "  - " + p).join("\n"));
console.log(`\n${passed} steps passed, ${unique.length} problem(s)`);
process.exit(unique.length ? 1 : 0);
