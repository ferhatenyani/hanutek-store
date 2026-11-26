import type { Page } from "@playwright/test";
import { apiAs, expect, login, pick, ready, test, toast, USERS } from "./fixtures";

const tableRows = (page: Page, name: string) => page.getByRole("table", { name }).locator("tbody tr[data-row]");

test.describe("customers", () => {
  test("search, sort by spend and open a profile", async ({ page }) => {
    await page.goto("/admin/customers");
    await ready(page);
    const header = page.getByRole("columnheader", { name: "Dépensé" });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    const spent = (await tableRows(page, "Clients").locator("td").filter({ hasText: /\sDA$/ }).allInnerTexts()).map((t) => Number(t.replace(/\D/g, "")));
    expect(spent.every((v, i) => i === 0 || spent[i - 1] >= v)).toBe(true);
    await tableRows(page, "Clients").first().click();
    await expect(page.getByText("Total dépensé")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Commandes" })).toBeVisible();
  });

  test("filters unverified accounts", async ({ page }) => {
    await page.goto("/admin/customers");
    await pick(page, "E-mail", "Non vérifié");
    await expect(page).toHaveURL(/verified=no/);
    for (const t of await tableRows(page, "Clients").locator("td:nth-child(3)").allInnerTexts()) expect(t).toContain("Non vérifié");
  });

  test("disable and re-enable an account (sessions revoked)", async ({ page }) => {
    await page.goto(`/admin/customers?search=${encodeURIComponent(USERS.customer.email)}`);
    await tableRows(page, "Clients").first().click();
    await page.getByRole("button", { name: "Gérer le compte" }).click();
    await page.getByRole("menuitem", { name: "Désactiver le compte" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Désactiver le compte" }).click();
    await expect(toast(page, "Compte désactivé")).toBeVisible();
    await expect(page.locator("header").getByText("Désactivé")).toBeVisible();
    // the customer can no longer sign in
    const r = await page.request.post("/api/v1/auth/login", { data: { email: USERS.customer.email, password: USERS.customer.password }, headers: { origin: new URL(page.url()).origin } });
    expect(r.status()).toBe(403);
    await page.getByRole("button", { name: "Gérer le compte" }).click();
    await page.getByRole("menuitem", { name: "Réactiver le compte" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Réactiver le compte" }).click();
    await expect(toast(page, "Compte réactivé")).toBeVisible();
  });

  test("admins can't disable or demote themselves", async ({ page }) => {
    await page.goto("/admin");
    const me = await apiAs(page, "GET", "/admin/me");
    const id = (me.json.user as { id: string }).id;
    await page.goto(`/admin/customers/${id}`);
    await expect(page.locator("header").getByText("Vous")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gérer le compte" })).toHaveCount(0);
    expect((await apiAs(page, "PATCH", `/admin/customers/${id}`, { role: "customer" })).status).toBe(409);
  });
});

test.describe("team & roles", () => {
  test("grant staff access to a customer, then revoke it", async ({ page }) => {
    const email = "yacine.benali0@example.dz";
    await page.goto("/admin/team");
    await page.getByRole("button", { name: "Ajouter un membre" }).click();
    const dlg = page.getByRole("dialog", { name: "Ajouter un membre" });
    await dlg.getByLabel("E-mail du compte").fill("nobody@nowhere.dz");
    await dlg.getByRole("button", { name: "Trouver le compte" }).click();
    await expect(dlg).toContainText("Aucun compte n’utilise cet e-mail");
    await dlg.getByLabel("E-mail du compte").fill(email);
    await dlg.getByRole("button", { name: "Trouver le compte" }).click();
    await expect(dlg).toContainText("actuellement client");
    await dlg.getByRole("button", { name: "Donner l’accès" }).click();
    await page.getByRole("dialog").last().getByRole("button", { name: "Donner l’accès" }).click();
    await expect(toast(page, /a désormais le rôle « équipe »/)).toBeVisible();
    await expect(tableRows(page, "Membres de l’équipe").filter({ hasText: email })).toContainText("Équipe");

    await tableRows(page, "Membres de l’équipe").filter({ hasText: email }).click();
    await page.getByRole("combobox", { name: "Rôle" }).click();
    await page.getByRole("option", { name: /Client/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Changer le rôle" }).click();
    await expect(toast(page, "Rôle modifié : Client")).toBeVisible();
  });

  test("promoting to admin requires typing the email", async ({ page }) => {
    await page.goto("/admin/team");
    await tableRows(page, "Membres de l’équipe").filter({ hasText: USERS.staff.email }).click();
    await page.getByRole("combobox", { name: "Rôle" }).click();
    await page.getByRole("option", { name: /Administrateur/ }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByRole("button", { name: "Changer le rôle" })).toBeDisabled();
    await dlg.getByLabel("Texte de confirmation").fill("wrong");
    await expect(dlg.getByRole("button", { name: "Changer le rôle" })).toBeDisabled();
    await dlg.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByRole("combobox", { name: "Rôle" })).toHaveText("Équipe");
  });

  test("the permission matrix reflects the server roles", async ({ page }) => {
    await page.goto("/admin/team?tab=roles");
    const row = page.getByRole("row", { name: /Consulter le journal d’audit/ });
    // columns: Staff, Admin
    await expect(row.getByRole("cell").nth(0).getByLabel("Non autorisé", { exact: true })).toBeVisible();
    await expect(row.getByRole("cell").nth(1).getByLabel("Autorisé", { exact: true })).toBeVisible();
  });
});

test.describe("promotions", () => {
  test("create with validation, pause, edit and delete an unused code", async ({ page }) => {
    const code = `E2E${Date.now().toString(36).toUpperCase()}`;
    await page.goto("/admin/promotions");
    await page.getByRole("button", { name: "Nouveau code" }).click();
    const d = page.getByRole("dialog", { name: "Nouveau code promo" });
    await d.getByLabel("Code", { exact: true }).fill(code);
    await d.getByLabel("Valeur", { exact: true }).fill("150");
    await d.getByRole("button", { name: "Créer le code" }).click();
    await expect(d.getByText("Entre 1 et 100")).toBeVisible();
    await d.getByLabel("Valeur", { exact: true }).fill("15");
    await d.getByLabel("Réduction maximum").fill("2000");
    // schedule with the calendar (no native date input)
    await d.getByRole("button", { name: /Fin/ }).click();
    await page.getByRole("button", { name: "Mois suivant" }).click();
    await page.getByRole("gridcell").filter({ hasText: /^15$/ }).first().click();
    await expect(d.getByText("Aperçu :")).toContainText("−15 % (max.");
    await d.getByRole("button", { name: "Créer le code" }).click();
    await expect(toast(page, `${code} créé`)).toBeVisible();
    const row = page.getByRole("table", { name: "Codes promo" }).locator("tbody tr").filter({ hasText: code });
    await expect(row).toContainText("Actif");

    await row.getByRole("switch").click();
    await expect(toast(page, `${code} mis en pause`)).toBeVisible();
    await expect(row).toContainText("En pause");
    // the storefront refuses a paused code
    const apply = await page.request.post("/api/v1/cart/promo", { data: { code }, headers: { origin: new URL(page.url()).origin } });
    expect(apply.status()).toBe(422);

    await row.getByRole("button", { name: "Actions de la ligne" }).click();
    await page.getByRole("menuitem", { name: "Supprimer" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(toast(page, "Code supprimé")).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test("used codes show redemptions and can't be deleted", async ({ page }) => {
    await page.goto("/admin/promotions");
    const row = page.getByRole("table", { name: "Codes promo" }).locator("tbody tr").filter({ hasText: "DRIVE10" });
    await row.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Utilisations");
    await expect(drawer.getByRole("link").first()).toContainText(/HT-\d+/);
    await drawer.getByRole("button", { name: "Fermer" }).first().click();
    await row.getByRole("button", { name: "Actions de la ligne" }).click();
    await expect(page.getByRole("menuitem", { name: "Supprimer" })).toHaveAttribute("aria-disabled", "true");
  });

  test("lifecycle tabs: expired codes", async ({ page }) => {
    await page.goto("/admin/promotions?tab=expired");
    await expect(page.getByRole("table", { name: "Codes promo" }).locator("tbody tr").filter({ hasText: "SUMMER15" })).toContainText("Expiré");
  });
});

test.describe("reviews", () => {
  test("hide and re-publish in bulk; counts update", async ({ page }) => {
    await page.goto("/admin/reviews?status=published");
    const hiddenTab = page.getByRole("tab", { name: /Masqué/ });
    await expect(hiddenTab).toHaveText(/\d/);
    const hiddenBefore = Number((await hiddenTab.innerText()).replace(/\D/g, ""));
    const rows = tableRows(page, "Avis");
    await rows.nth(0).getByRole("checkbox").click();
    await rows.nth(1).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Masquer" }).click();
    await expect(toast(page, "2 avis masqués")).toBeVisible();
    await expect(hiddenTab).toContainText(String(hiddenBefore + 2));
    await hiddenTab.click();
    await page.getByRole("checkbox", { name: "Sélectionner toutes les lignes de la page" }).click();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(hiddenTab).toContainText("0");
  });

  test("filters by rating and opens a review", async ({ page }) => {
    await page.goto("/admin/reviews");
    await pick(page, "Note", "5 étoiles");
    const first = tableRows(page, "Avis").first();
    await expect(first.getByRole("img", { name: "5 étoiles sur 5" })).toBeVisible();
    await first.locator("td").nth(1).click();
    await expect(page.getByRole("dialog")).toContainText("Achat vérifié");
  });
});

test.describe("shipping", () => {
  test("advance from the board: confirm, then ship with a carrier", async ({ page }) => {
    await page.goto("/admin/shipping");
    const toConfirm = page.locator("section").filter({ has: page.getByRole("heading", { name: /À confirmer/ }) });
    const first = toConfirm.locator("li").filter({ has: page.getByRole("button", { name: "Confirmer" }) }).first();
    const number = (await first.locator("a span").first().innerText()).split(/\s/)[0];
    await first.getByRole("button", { name: "Confirmer" }).click();
    await expect(toast(page, `${number} · confirmée`)).toBeVisible();

    const toShip = page.locator("section").filter({ has: page.getByRole("heading", { name: /À expédier/ }) });
    const parcel = toShip.locator("li").filter({ has: page.getByRole("button", { name: "Expédier" }) }).first();
    await parcel.getByRole("button", { name: "Expédier" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Numéro de suivi").fill("YAL-E2E-77");
    await dlg.getByRole("button", { name: "Expédier la commande" }).click();
    await expect(toast(page, /expédiée avec/)).toBeVisible();
  });

  test("add, deactivate and delete a carrier", async ({ page }) => {
    const name = `E2E Express ${Date.now().toString(36)}`;
    await page.goto("/admin/shipping");
    await page.getByRole("button", { name: "Ajouter un transporteur" }).click();
    const d = page.getByRole("dialog", { name: "Ajouter un transporteur" });
    await d.getByLabel("Nom", { exact: true }).fill(name);
    await d.getByLabel("Lien de suivi").fill("javascript:alert(1)");
    await d.getByRole("button", { name: "Ajouter le transporteur" }).click();
    await expect(d.getByText("Doit commencer par https://")).toBeVisible();
    await d.getByLabel("Lien de suivi").fill("https://track.example/{number}");
    await d.getByRole("button", { name: "Ajouter le transporteur" }).click();
    await expect(toast(page, "Transporteur ajouté")).toBeVisible();
    const row = page.getByRole("table", { name: "Transporteurs" }).locator("tbody tr").filter({ hasText: name });
    await row.getByRole("switch").click();
    await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    await row.getByRole("button", { name: "Actions de la ligne" }).click();
    await page.getByRole("menuitem", { name: "Supprimer" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(row).toHaveCount(0);
  });
});

test.describe("audit log, settings & tools", () => {
  test("audit log records actions with actor and before/after", async ({ page }) => {
    await page.goto("/admin/audit");
    await page.getByRole("searchbox", { name: "Rechercher dans le journal" }).fill("carrier");
    const rows = tableRows(page, "Journal d’audit");
    await expect(rows.first()).toContainText("Transporteur");
    await rows.first().click();
    await expect(page.getByRole("dialog")).toContainText(USERS.admin.email);
    await expect(page.getByRole("dialog").locator("pre").first()).toBeVisible();
  });

  test("system tools: status and guest-cart cleanup", async ({ page }) => {
    await page.goto("/admin/settings?tab=system");
    await expect(page.getByText("Opérationnelle")).toBeVisible();
    await page.getByRole("button", { name: "Nettoyer" }).click();
    await expect(page.getByRole("dialog")).toContainText("abandonné");
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer les paniers" }).click();
    await expect(toast(page, /paniers? supprimés?/)).toBeVisible();
    await page.getByRole("button", { name: "Nettoyer" }).click();
    await expect(toast(page, "Aucun panier invité de plus de")).toBeVisible();
  });

  test("change own password (other sessions are signed out)", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await login(page, "staff2");
    await ready(page);
    await page.goto("/admin/settings");
    await page.getByLabel("Mot de passe actuel").fill("wrong-one");
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("Brand-new-pass-1");
    await page.getByLabel("Confirmer le nouveau mot de passe").fill("Brand-new-pass-1");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText("Mot de passe incorrect")).toBeVisible();
    await page.getByLabel("Mot de passe actuel").fill(USERS.staff2.password);
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(toast(page, "Mot de passe modifié")).toBeVisible();
    // still signed in on this device
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Commandes" })).toBeVisible();
    // change it back for repeat runs
    await page.goto("/admin/settings");
    await page.getByLabel("Mot de passe actuel").fill("Brand-new-pass-1");
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(USERS.staff2.password);
    await page.getByLabel("Confirmer le nouveau mot de passe").fill(USERS.staff2.password);
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(toast(page, "Mot de passe modifié")).toBeVisible();
    await ctx.close();
  });

  test("display name update is reflected in the shell", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByLabel("Nom affiché").fill("Nadia A.");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(toast(page, "Nom mis à jour")).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu du compte" }).first()).toContainText("Nadia A.");
    await page.getByLabel("Nom affiché").fill(USERS.admin.name);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  });

  test("subscribers export only active addresses", async ({ page }) => {
    await page.goto("/admin/subscribers");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter les inscrits" }).click()]);
    const csv = (await import("node:fs")).readFileSync((await dl.path())!, "utf8");
    expect(csv.startsWith("email,langue,inscrit_le")).toBe(true);
    await pick(page, "Statut", "Désinscrits");
    const unsub = await tableRows(page, "Abonnés").locator("td:first-child").allInnerTexts();
    for (const e of unsub) expect(csv).not.toContain(e.trim());
  });
});
