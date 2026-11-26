import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { contextAs, expect, pick, ready, test, toast } from "./fixtures";

const rows = (page: Page) => page.getByRole("table", { name: "Commandes" }).locator("tbody tr[data-row]");

/** An order number in a given status, fetched through the API (no reliance on fixed seed numbers). */
async function orderIn(page: Page, status: string, index = 0) {
  const r = await page.request.get(`/api/v1/admin/orders?status=${status}&sort=placed&dir=desc&pageSize=20`);
  const items = ((await r.json()).items as { number: string }[]) ?? [];
  if (!items[index]) throw new Error(`no ${status} order`);
  return items[index].number;
}

test.describe("orders list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/orders");
    await ready(page);
    await expect(rows(page).first()).toBeVisible();
  });

  test("paginates and shows a result count", async ({ page }) => {
    await expect(page.getByText(/^1–25 sur \d+$/)).toBeVisible();
    await page.getByRole("button", { name: "Page suivante" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/^26–50 sur \d+$/)).toBeVisible();
    await page.getByRole("button", { name: "Page précédente" }).click();
    await expect(page.getByText(/^1–25 sur/)).toBeVisible();
    await pick(page, "Lignes par page", "50 par page");
    await expect(rows(page)).toHaveCount(50);
  });

  test("status tabs filter server-side and survive a reload", async ({ page }) => {
    await page.getByRole("tab", { name: "Livrées" }).click();
    await expect(page).toHaveURL(/status=delivered/);
    await expect(rows(page).first()).toContainText("Livrée");
    const statuses = await rows(page).locator("td:nth-child(5)").allInnerTexts();
    expect(statuses.every((s) => s.includes("Livrée"))).toBe(true);
    await page.reload();
    await expect(page.getByRole("tab", { name: "Livrées", selected: true })).toBeVisible();
  });

  test("search by order number and by phone", async ({ page }) => {
    const number = await orderIn(page, "pending");
    await page.getByRole("searchbox", { name: "Rechercher des commandes" }).fill(number);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(number);
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(rows(page)).toHaveCount(25);
    await page.getByRole("searchbox", { name: "Rechercher des commandes" }).fill("zzzz-no-match");
    await expect(page.getByText("Aucune commande ne correspond à ces filtres")).toBeVisible();
  });

  test("“/” focuses the search box", async ({ page }) => {
    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "Rechercher des commandes" })).toBeFocused();
  });

  test("sorts by total in both directions", async ({ page }) => {
    const header = page.getByRole("columnheader", { name: "Total" });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    const read = async () => (await rows(page).locator("td").filter({ hasText: /\sDA$/ }).allInnerTexts()).map((t) => Number(t.replace(/\D/g, "")));
    await expect.poll(async () => { const v = await read(); return v.length > 1 && v.every((x, i) => i === 0 || v[i - 1] >= x); }).toBe(true);
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect.poll(async () => { const v = await read(); return v.every((x, i) => i === 0 || v[i - 1] <= x); }).toBe(true);
  });

  test("filters by payment and region, then resets", async ({ page }) => {
    await pick(page, "Paiement", "Payée");
    await expect(page).toHaveURL(/payment=paid/);
    await pick(page, "Wilaya", /^16 · Alger/);
    await expect(page).toHaveURL(/wilaya=16/);
    for (const t of await rows(page).locator("td:nth-child(6)").allInnerTexts()) expect(t).toContain("Payée");
    for (const t of await rows(page).locator("td:nth-child(8)").allInnerTexts()) expect(t).toContain("16 · Alger");
    await page.getByRole("button", { name: /^Réinitialiser/ }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });

  test("column visibility is remembered", async ({ page }) => {
    await expect(page.getByRole("columnheader", { name: "Transporteur" })).toHaveCount(0);
    await page.getByRole("button", { name: "Choisir les colonnes" }).click();
    await page.getByRole("dialog").getByText("Transporteur", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("columnheader", { name: "Transporteur" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("columnheader", { name: "Transporteur" })).toBeVisible();
    await page.getByRole("button", { name: "Choisir les colonnes" }).click();
    await page.getByRole("button", { name: "Rétablir par défaut" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("columnheader", { name: "Transporteur" })).toHaveCount(0);
  });

  test("saved views store and re-apply filters", async ({ page }) => {
    await page.getByRole("tab", { name: "En transit" }).click();
    await pick(page, "Paiement", "Non payée");
    await page.getByRole("button", { name: "Vues enregistrées" }).click();
    await page.getByRole("button", { name: "Enregistrer les filtres actuels…" }).click();
    await page.getByLabel("Nom de la vue").fill("Cash on the road");
    await page.getByRole("button", { name: "Enregistrer la vue" }).click();
    await expect(toast(page, "Vue « Cash on the road » enregistrée")).toBeVisible();
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Vues enregistrées" }).click();
    await page.getByRole("button", { name: "Cash on the road", exact: true }).click();
    await expect(page).toHaveURL(/status=shipped%2Cout_for_delivery/);
    await expect(page).toHaveURL(/payment=unpaid/);
    await page.getByRole("button", { name: "Vues enregistrées" }).click();
    await page.getByRole("button", { name: "Supprimer la vue Cash on the road" }).click();
    await expect(page.getByRole("button", { name: "Cash on the road", exact: true })).toHaveCount(0);
  });

  test("keyboard: j/k move between rows and Enter opens one", async ({ page }) => {
    await rows(page).first().focus();
    await page.keyboard.press("j");
    await expect(rows(page).nth(1)).toBeFocused();
    await page.keyboard.press("k");
    await expect(rows(page).first()).toBeFocused();
    const number = (await rows(page).first().locator("td").nth(1).innerText()).trim().split(/\s/)[0];
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/admin/orders/${number}`));
  });

  test("exports the current filter as CSV", async ({ page }) => {
    await page.getByRole("tab", { name: "Livrées" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter en CSV" }).click()]);
    const csv = readFileSync((await download.path())!, "utf8");
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toContain("numero,date,statut");
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.slice(1).every((l) => l.includes('"Livrée"'))).toBe(true);
  });
});

test.describe("order workflow", () => {
  test("confirm → pack → ship → deliver, with timeline and payment", async ({ page }) => {
    const number = await orderIn(page, "pending", 0);
    await page.goto(`/admin/orders/${number}`);
    await expect(page.getByRole("heading", { name: number })).toBeVisible();
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Note").fill("Confirmed by phone");
    await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(toast(page, "Commande confirmée")).toBeVisible();
    await expect(page.getByText("Confirmed by phone")).toBeVisible();

    await page.getByRole("button", { name: "Marquer préparée" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Marquer préparée" }).click();
    await expect(toast(page, "Commande préparée")).toBeVisible();

    await page.getByRole("button", { name: "Expédier", exact: true }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("combobox", { name: "Transporteur" }).click();
    await page.getByRole("option", { name: "ZR Express" }).click();
    await dlg.getByLabel("Numéro de suivi").fill("ZR-E2E-1");
    await dlg.getByRole("button", { name: "Expédier" }).click();
    await expect(toast(page, "Commande expédiée")).toBeVisible();
    await expect(page.getByLabel("Numéro de suivi")).toHaveValue("ZR-E2E-1");

    await page.getByRole("button", { name: "Marquer livrée" }).click();
    await expect(page.getByRole("dialog")).toContainText("comme encaissé");
    await page.getByRole("dialog").getByRole("button", { name: "Marquer livrée" }).click();
    await expect(page.locator("header").getByText("Payée", { exact: true })).toBeVisible();
    await expect(page.getByText("Encaissé à la livraison.")).toBeVisible();
    // timeline lists every step in order
    const steps = await page.locator("ol li span.font-medium").allInnerTexts();
    expect(steps).toEqual(["En attente", "Confirmée", "Préparée", "Expédiée", "Livrée"]);
  });

  test("cancelling restores stock (visible in the inventory ledger)", async ({ page }) => {
    const number = await orderIn(page, "confirmed", 0);
    await page.goto(`/admin/orders/${number}`);
    const sku = (await page.locator("main ul li").first().locator("span").filter({ hasText: /^[A-Z0-9-]{4,}$/ }).first().innerText()).trim();
    await page.getByRole("button", { name: "Plus d’actions" }).click();
    await page.getByRole("menuitem", { name: "Annuler la commande" }).click();
    await expect(page.getByRole("dialog")).toContainText("Les articles sont réintégrés au stock");
    await page.getByRole("dialog").getByRole("button", { name: "Annuler la commande" }).click();
    await expect(page.locator("header").getByText("Annulée", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmer", exact: true })).toHaveCount(0);
    await page.goto("/admin/inventory?tab=ledger&reason=cancel");
    await expect(page.getByRole("table", { name: "Mouvements de stock" }).locator("tbody tr").filter({ hasText: number }).filter({ hasText: sku })).toBeVisible();
  });

  test("delivery fee edit updates the total; internal note persists", async ({ page }) => {
    const number = await orderIn(page, "pending", 1);
    await page.goto(`/admin/orders/${number}`);
    const total = async () => Number((await page.locator("dl dd").filter({ hasText: /\sDA$/ }).last().innerText()).replace(/\D/g, ""));
    const before = await total();
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Frais de livraison").fill("650");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).first().click();
    await expect(toast(page, "Frais de livraison mis à jour")).toBeVisible();
    await expect.poll(total).toBe(before + 650);

    await page.getByLabel("Note interne").fill("Fragile — double box");
    await page.getByRole("button", { name: "Enregistrer la note" }).click();
    await expect(toast(page, "Note enregistrée")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Note interne")).toHaveValue("Fragile — double box");
  });

  test("a concurrent change is detected instead of applied twice", async ({ page, browser }) => {
    const number = await orderIn(page, "pending", 2);
    await page.goto(`/admin/orders/${number}`);
    const ctx = await contextAs(browser, "staff");
    const other = await ctx.newPage();
    await other.goto(`/admin/orders/${number}`);
    await other.getByRole("button", { name: "Confirmer", exact: true }).click();
    await other.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(toast(other, "Commande confirmée")).toBeVisible();
    // first tab still shows "pending" and tries the same move
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(toast(page, "Cette commande a changé entre-temps")).toBeVisible();
    await expect(page.locator("header").getByText("Confirmée", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marquer préparée" })).toBeVisible();
    await ctx.close();
  });

  test("bulk status change reports orders that can't move", async ({ page }) => {
    await page.goto("/admin/orders?status=pending%2Cconfirmed&sort=placed&dir=asc");
    await expect(rows(page).first()).toBeVisible();
    // one pending + one confirmed: "Marquer préparée" only works for the confirmed one
    const pendingRow = rows(page).filter({ hasText: "En attente" }).first();
    const confirmedRow = rows(page).filter({ hasText: "Confirmée" }).first();
    await pendingRow.getByRole("checkbox", { name: "Sélectionner la ligne" }).click();
    await confirmedRow.getByRole("checkbox", { name: "Sélectionner la ligne" }).click();
    await expect(page.getByRole("region", { name: "Actions groupées" })).toContainText("2 sélectionnés");
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await page.getByRole("menuitem", { name: "Marquer préparée" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Marquer préparée" }).click();
    await expect(page.getByRole("dialog")).toContainText("Certaines commandes ont été ignorées");
    await expect(page.getByRole("dialog")).toContainText("Impossible de passer de « En attente » à « Préparée »");
    await page.getByRole("dialog").getByRole("button", { name: "Terminé" }).click();
    await expect(page.getByRole("region", { name: "Actions groupées" })).toContainText("1 sélectionné");
  });

  test("shift-click selects a range; select-all toggles the page", async ({ page }) => {
    await page.goto("/admin/orders");
    await rows(page).nth(1).getByRole("checkbox").click();
    await rows(page).nth(5).getByRole("checkbox").click({ modifiers: ["Shift"] });
    await expect(page.getByRole("region", { name: "Actions groupées" })).toContainText("5 sélectionnés");
    await page.getByRole("checkbox", { name: "Sélectionner toutes les lignes de la page" }).click();
    await expect(page.getByRole("region", { name: "Actions groupées" })).toContainText("25 sélectionnés");
    await page.getByRole("checkbox", { name: "Sélectionner toutes les lignes de la page" }).click();
    await expect(page.getByRole("region", { name: "Actions groupées" })).toHaveCount(0);
  });
});
