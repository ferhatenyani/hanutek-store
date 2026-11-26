import sharp from "sharp";
import type { Page } from "@playwright/test";
import { contextAs, expect, pick, ready, test, toast } from "./fixtures";

const productRows = (page: Page) => page.getByRole("table", { name: "Produits" }).locator("tbody tr[data-row]");
const stamp = () => Date.now().toString(36);

test.describe("products", () => {
  test("filters by status tab, stock level and search (SKU)", async ({ page }) => {
    await page.goto("/admin/products");
    await ready(page);
    await expect(productRows(page).first()).toBeVisible();
    const all = await productRows(page).count();
    await pick(page, "Stock", "Épuisé");
    await expect(page).toHaveURL(/stock=out/);
    await expect(productRows(page).first().or(page.getByText("Aucun produit ne correspond à ces filtres"))).toBeVisible();
    await page.getByRole("button", { name: /^Réinitialiser/ }).click();
    await expect(productRows(page)).toHaveCount(all);
    await page.getByRole("searchbox", { name: "Rechercher des produits" }).fill("JUMPCORE");
    await expect(productRows(page).first()).toContainText("JumpCore");
  });

  test("create: validation, then a full product with two variants", async ({ page }) => {
    const id = stamp();
    await page.goto("/admin/products/new");
    await page.getByRole("button", { name: "Créer le produit" }).click();
    await expect(toast(page, "Vérifiez les champs en surbrillance")).toBeVisible();
    await expect(page.getByText("Le nom est obligatoire")).toBeVisible();
    await expect(page.getByLabel("Nom", { exact: true })).toBeFocused();

    await page.getByLabel("Nom", { exact: true }).fill(`E2E Phone Holder ${id}`);
    await expect(page.getByLabel("Identifiant d’URL")).toHaveValue(`e2e-phone-holder-${id}`);
    await page.getByRole("combobox", { name: "Catégorie" }).click();
    await page.getByRole("option", { name: /Intérieur/ }).click();
    await page.getByLabel("Description courte", { exact: true }).fill("Magnetic holder for the dashboard.");
    await page.getByLabel("Description", { exact: true }).fill("Strong N52 magnets, one-hand use, fits every phone.");
    await page.getByRole("button", { name: "Ajouter", exact: true }).first().click();
    await page.getByLabel("Caractéristique 1 : nom").fill("Fixation");
    await page.getByLabel("Caractéristique 1 : valeur").fill("Magnétique");
    // Arabic tab
    await page.getByRole("tab", { name: /Arabe/ }).click();
    await page.getByLabel("Description courte (arabe)").fill("حامل مغناطيسي للوحة القيادة.");
    await page.getByLabel("Description (arabe)", { exact: true }).fill("مغناطيس قوي، استعمال بيد واحدة.");
    // variants
    await page.getByLabel("SKU").first().fill(`E2E-HOLD-${id}`.toUpperCase());
    await page.getByLabel("Prix", { exact: true }).first().fill("2900");
    await page.getByLabel("Stock initial").first().fill("12");
    await page.getByRole("button", { name: "Ajouter une variante" }).click();
    await page.getByLabel("Libellé (FR)").nth(1).fill("Pack de 2");
    await page.getByLabel("Libellé (AR)").nth(1).fill("علبة من 2");
    await page.getByLabel("SKU").nth(1).fill(`E2E-HOLD-${id}-X2`.toUpperCase());
    await page.getByLabel("Prix", { exact: true }).nth(1).fill("4900");
    await page.getByLabel("Prix barré").nth(1).fill("5800");
    await page.getByLabel("Stock initial").nth(1).fill("4");
    await page.getByRole("button", { name: "Créer le produit" }).click();
    await expect(toast(page, "Produit créé")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: `E2E Phone Holder ${id}` })).toBeVisible();
    await expect(page.locator("header").getByText("Brouillon")).toBeVisible();
    // persisted after reload
    await page.reload();
    await expect(page.getByLabel("SKU").nth(1)).toHaveValue(`E2E-HOLD-${id}-X2`.toUpperCase());
    await expect(page.getByLabel("Caractéristique 1 : valeur")).toHaveValue("Magnétique");
  });

  test("duplicate SKUs are caught before the request", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByLabel("SKU").first().fill("SAME-SKU");
    await page.getByRole("button", { name: "Ajouter une variante" }).click();
    await page.getByLabel("SKU").nth(1).fill("SAME-SKU");
    await page.getByRole("button", { name: "Créer le produit" }).click();
    await expect(page.getByText("SKU en double")).toBeVisible();
  });

  test("a server-side conflict (slug already used) is shown on the field", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByLabel("Nom", { exact: true }).fill("Copy of a dash cam");
    await page.getByLabel("Identifiant d’URL").fill("roadeye-dual-dash-cam");
    await page.getByRole("combobox", { name: "Catégorie" }).click();
    await page.getByRole("option", { name: /Vision/ }).click();
    await page.getByLabel("Description courte", { exact: true }).fill("x".repeat(12));
    await page.getByLabel("Description", { exact: true }).fill("y".repeat(20));
    await page.getByLabel("SKU").first().fill(`UNIQUE-${stamp()}`.toUpperCase());
    await page.getByLabel("Prix", { exact: true }).first().fill("1000");
    await page.getByRole("button", { name: "Créer le produit" }).click();
    await expect(toast(page, "Enregistrement impossible")).toBeVisible();
    await expect(page.getByLabel("Identifiant d’URL")).toHaveAttribute("aria-invalid", "true");
  });

  test("edit, save with Ctrl+S, discard; unsaved changes block the save button state", async ({ page }) => {
    await page.goto("/admin/products?search=lumencore");
    await productRows(page).first().click();
    await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeDisabled();
    const price = page.getByLabel("Prix", { exact: true }).first();
    const original = await price.inputValue();
    await price.fill(String(Number(original) + 100));
    await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeEnabled();
    await page.keyboard.press("Control+s");
    await expect(toast(page, "Modifications enregistrées")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Prix", { exact: true }).first()).toHaveValue(String(Number(original) + 100));
    await page.getByLabel("Prix", { exact: true }).first().fill("1");
    await page.getByRole("button", { name: "Abandonner" }).click();
    await expect(page.getByLabel("Prix", { exact: true }).first()).toHaveValue(String(Number(original) + 100));
  });

  test("optimistic concurrency: a stale editor can't overwrite newer changes", async ({ page, browser }) => {
    await page.goto("/admin/products?search=snowfoam");
    await productRows(page).first().click();
    await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(/SnowFoam/);
    const url = page.url();
    const ctx = await contextAs(browser, "staff");
    const other = await ctx.newPage();
    await other.goto(url);
    await other.getByLabel("Position de tri").fill("7");
    await other.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(toast(other, "Modifications enregistrées")).toBeVisible();
    await ctx.close();

    await page.getByLabel("Position de tri").fill("9");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).filter({ hasText: "modifié par quelqu’un d’autre" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Recharger la dernière version" }).click();
    await expect(page.getByLabel("Position de tri")).toHaveValue("7");
    await page.getByLabel("Position de tri").fill("9");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(toast(page, "Modifications enregistrées")).toBeVisible();
  });

  test("image upload, reorder and delete", async ({ page }, testInfo) => {
    await page.goto("/admin/products?search=gripdash");
    await productRows(page).first().click();
    const images = page.getByRole("heading", { name: "Images" }).locator("xpath=ancestor::section[1]").locator("ul li img");
    await expect(images.first()).toBeVisible(); // editor loaded
    const before = await images.count();
    const file = testInfo.outputPath("upload.png");
    await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 30, g: 90, b: 160 } } }).png().toFile(file);
    await page.getByLabel("Envoyer des images").setInputFiles(file);
    await expect(images).toHaveCount(before + 1);
    await expect(images.last()).toHaveAttribute("src", /\.webp$/);
    // move the new image to the front (cover)
    for (let i = 0; i < before; i++) {
      await page.getByRole("button", { name: "Avancer l’image" }).last().click();
    }
    await expect(images.first()).toHaveAttribute("src", /\/uploads\//);
    page.once("dialog", () => undefined);
    await page.getByRole("button", { name: "Supprimer l’image" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(images).toHaveCount(before);
  });

  test("rejects a file that isn't really an image", async ({ page }) => {
    await page.goto("/admin/products?search=gripdash");
    await productRows(page).first().click();
    await page.getByLabel("Envoyer des images").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<html>nope</html>") });
    await expect(toast(page, "Échec de l’envoi de fake.png")).toBeVisible();
  });

  test("bulk: move to draft, then archive with undo", async ({ page }) => {
    await page.goto("/admin/products?status=active&sort=name&dir=asc");
    await expect(productRows(page).first()).toBeVisible();
    const names = (await productRows(page).locator("td:nth-child(2) span.font-medium").allInnerTexts()).slice(0, 2);
    await productRows(page).nth(0).getByRole("checkbox").click();
    await productRows(page).nth(1).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Passer en brouillon" }).click();
    await expect(toast(page, "Passés en brouillon · 2 produits")).toBeVisible();
    await page.getByRole("tab", { name: "Brouillon" }).click();
    for (const n of names) await expect(productRows(page).filter({ hasText: n })).toBeVisible();
    // restore
    await productRows(page).filter({ hasText: names[0] }).getByRole("checkbox").click();
    await productRows(page).filter({ hasText: names[1] }).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(toast(page, "Publiés · 2 produits")).toBeVisible();

    // archive one from the row menu, then undo
    await page.goto("/admin/products?status=active&sort=name&dir=asc");
    await productRows(page).first().getByRole("button", { name: "Actions de la ligne" }).click();
    await page.getByRole("menuitem", { name: "Archiver" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archiver" }).click();
    await expect(toast(page, "Produit archivé")).toBeVisible();
    await toast(page, "Produit archivé").getByRole("button", { name: "Annuler" }).click();
    await expect(toast(page, "Restauré")).toBeVisible();
    await page.reload();
    await expect(productRows(page).first()).toContainText(names[0]);
  });
});

test.describe("inventory", () => {
  test("inline edits are reviewed and saved together, then show in the ledger", async ({ page }) => {
    await page.goto("/admin/inventory?sort=sku&dir=asc");
    const table = page.getByRole("table", { name: "Stock" });
    const r0 = table.locator("tbody tr[data-row]").nth(0);
    const r1 = table.locator("tbody tr[data-row]").nth(1);
    const in0 = r0.getByRole("textbox");
    const in1 = r1.getByRole("textbox");
    const v0 = Number(await in0.inputValue());
    const v1 = Number(await in1.inputValue());
    await in0.fill(String(v0 + 10));
    await in1.fill(String(v1 + 3));
    await expect(page.getByRole("region", { name: "Modifications de stock non enregistrées" })).toContainText("2 unsaved changes");
    await page.getByRole("button", { name: "Vérifier et enregistrer" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText("+10");
    await expect(dlg).toContainText("+3");
    await pick(page, "Motif", "Réassort");
    await dlg.getByLabel("Note").fill("E2E delivery");
    await dlg.getByRole("button", { name: "Enregistrer 2 modifications" }).click();
    await expect(toast(page, "Stock mis à jour")).toBeVisible();
    await expect(in0).toHaveValue(String(v0 + 10));
    await page.goto("/admin/inventory?tab=ledger&reason=restock");
    await expect(page.getByRole("table", { name: "Mouvements de stock" }).locator("tbody tr").filter({ hasText: "E2E delivery" })).toHaveCount(2);
  });

  test("discarding edits restores the values; Escape reverts one field", async ({ page }) => {
    await page.goto("/admin/inventory?sort=sku&dir=asc");
    const input = page.getByRole("table", { name: "Stock" }).locator("tbody tr[data-row]").nth(2).getByRole("textbox");
    const v = await input.inputValue();
    await input.fill("999");
    await input.press("Escape");
    await expect(input).toHaveValue(v);
    await input.fill("998");
    await page.getByRole("button", { name: "Abandonner" }).click();
    await expect(input).toHaveValue(v);
  });

  test("adjust dialog prevents removing more than on hand", async ({ page }) => {
    await page.goto("/admin/inventory?stock=low");
    const row = page.getByRole("table", { name: "Stock" }).locator("tbody tr[data-row]").first();
    await row.getByRole("button", { name: "Actions de la ligne" }).click();
    await page.getByRole("menuitem", { name: "Ajuster le stock…" }).click();
    const dlg = page.getByRole("dialog", { name: "Ajuster le stock" });
    await dlg.getByRole("radio", { name: "Retirer" }).click();
    await dlg.getByLabel("Quantité").fill("9999");
    await expect(dlg.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    await dlg.getByRole("radio", { name: "Ajouter" }).click();
    await expect(dlg.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
    await dlg.getByRole("button", { name: "Enregistrer" }).click();
    await expect(toast(page, /Stock mis à jour/)).toBeVisible();
  });

  test("summary cards filter the list", async ({ page }) => {
    await page.goto("/admin/inventory");
    await page.getByRole("button", { name: /^\d+$/ }).last().click();
    await expect(page).toHaveURL(/stock=out/);
    const badges = await page.getByRole("table", { name: "Stock" }).locator("tbody tr[data-row]").count();
    expect(badges).toBeGreaterThan(0);
  });
});

test.describe("categories", () => {
  test("create, edit and delete an empty category; non-empty ones can't be deleted", async ({ page }) => {
    const slug = `e2e-${stamp()}`;
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "Nouvelle catégorie" }).click();
    const drawer = page.getByRole("dialog", { name: "Nouvelle catégorie" });
    await drawer.getByRole("button", { name: "Créer la catégorie" }).click();
    await expect(drawer.getByText("Obligatoire").first()).toBeVisible();
    await drawer.getByLabel("Nom", { exact: true }).fill("Accessoires E2E");
    await drawer.getByLabel("Nom court", { exact: true }).fill("Accessoires");
    await drawer.getByLabel("Identifiant d’URL").fill(slug);
    await drawer.getByRole("button", { name: "Créer la catégorie" }).click();
    await expect(toast(page, "Catégorie créée")).toBeVisible();
    const row = page.getByRole("table", { name: "Catégories" }).locator("tbody tr").filter({ hasText: slug });
    await expect(row).toContainText("Visible");
    await row.click();
    await page.getByRole("dialog").getByRole("switch", { name: "Visible sur la boutique" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
    await expect(row).toContainText("Masquée");
    await row.getByRole("button", { name: "Actions de la ligne" }).click();
    await page.getByRole("menuitem", { name: "Supprimer" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(toast(page, "Catégorie supprimée")).toBeVisible();
    await expect(row).toHaveCount(0);

    const full = page.getByRole("table", { name: "Catégories" }).locator("tbody tr").filter({ hasText: "vision" });
    await full.getByRole("button", { name: "Actions de la ligne" }).click();
    await expect(page.getByRole("menuitem", { name: "Supprimer" })).toHaveAttribute("aria-disabled", "true");
  });
});
