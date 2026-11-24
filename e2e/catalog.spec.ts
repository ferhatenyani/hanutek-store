import sharp from "sharp";
import type { Page } from "@playwright/test";
import { contextAs, expect, pick, ready, test, toast } from "./fixtures";

const productRows = (page: Page) => page.getByRole("table", { name: "Products" }).locator("tbody tr[data-row]");
const stamp = () => Date.now().toString(36);

test.describe("products", () => {
  test("filters by status tab, stock level and search (SKU)", async ({ page }) => {
    await page.goto("/admin/products");
    await ready(page);
    await expect(productRows(page).first()).toBeVisible();
    const all = await productRows(page).count();
    await pick(page, "Stock", "Out of stock");
    await expect(page).toHaveURL(/stock=out/);
    await expect(productRows(page).first().or(page.getByText("No products match these filters"))).toBeVisible();
    await page.getByRole("button", { name: /^Reset/ }).click();
    await expect(productRows(page)).toHaveCount(all);
    await page.getByRole("searchbox", { name: "Search products" }).fill("JUMPCORE");
    await expect(productRows(page).first()).toContainText("JumpCore");
  });

  test("create: validation, then a full product with two variants", async ({ page }) => {
    const id = stamp();
    await page.goto("/admin/products/new");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(toast(page, "Check the highlighted fields")).toBeVisible();
    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused();

    await page.getByLabel("Name", { exact: true }).fill(`E2E Phone Holder ${id}`);
    await expect(page.getByLabel("URL slug")).toHaveValue(`e2e-phone-holder-${id}`);
    await page.getByRole("combobox", { name: "Category" }).click();
    await page.getByRole("option", { name: /Intérieur/ }).click();
    await page.getByLabel("Short description").fill("Magnetic holder for the dashboard.");
    await page.getByLabel("Description", { exact: true }).fill("Strong N52 magnets, one-hand use, fits every phone.");
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.getByLabel("Spec 1 name").fill("Fixation");
    await page.getByLabel("Spec 1 value").fill("Magnétique");
    // Arabic tab
    await page.getByRole("tab", { name: /العربية/ }).click();
    await page.getByLabel("الوصف المختصر").fill("حامل مغناطيسي للوحة القيادة.");
    await page.getByLabel("الوصف", { exact: true }).fill("مغناطيس قوي، استعمال بيد واحدة.");
    // variants
    await page.getByLabel("SKU").first().fill(`E2E-HOLD-${id}`.toUpperCase());
    await page.getByLabel("Price").first().fill("2900");
    await page.getByLabel("Initial stock").first().fill("12");
    await page.getByRole("button", { name: "Add variant" }).click();
    await page.getByLabel("Label (FR)").nth(1).fill("Pack de 2");
    await page.getByLabel("Label (AR)").nth(1).fill("علبة من 2");
    await page.getByLabel("SKU").nth(1).fill(`E2E-HOLD-${id}-X2`.toUpperCase());
    await page.getByLabel("Price").nth(1).fill("4900");
    await page.getByLabel("Compare-at").nth(1).fill("5800");
    await page.getByLabel("Initial stock").nth(1).fill("4");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(toast(page, "Product created")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: `E2E Phone Holder ${id}` })).toBeVisible();
    await expect(page.locator("header").getByText("Draft")).toBeVisible();
    // persisted after reload
    await page.reload();
    await expect(page.getByLabel("SKU").nth(1)).toHaveValue(`E2E-HOLD-${id}-X2`.toUpperCase());
    await expect(page.getByLabel("Spec 1 value")).toHaveValue("Magnétique");
  });

  test("duplicate SKUs are caught before the request", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByLabel("SKU").first().fill("SAME-SKU");
    await page.getByRole("button", { name: "Add variant" }).click();
    await page.getByLabel("SKU").nth(1).fill("SAME-SKU");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText("Duplicate SKU")).toBeVisible();
  });

  test("a server-side conflict (slug already used) is shown on the field", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.getByLabel("Name", { exact: true }).fill("Copy of a dash cam");
    await page.getByLabel("URL slug").fill("roadeye-dual-dash-cam");
    await page.getByRole("combobox", { name: "Category" }).click();
    await page.getByRole("option", { name: /Vision/ }).click();
    await page.getByLabel("Short description").fill("x".repeat(12));
    await page.getByLabel("Description", { exact: true }).fill("y".repeat(20));
    await page.getByLabel("SKU").first().fill(`UNIQUE-${stamp()}`.toUpperCase());
    await page.getByLabel("Price").first().fill("1000");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(toast(page, "Couldn't save")).toBeVisible();
    await expect(page.getByLabel("URL slug")).toHaveAttribute("aria-invalid", "true");
  });

  test("edit, save with Ctrl+S, discard; unsaved changes block the save button state", async ({ page }) => {
    await page.goto("/admin/products?search=lumencore");
    await productRows(page).first().click();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
    const price = page.getByLabel("Price").first();
    const original = await price.inputValue();
    await price.fill(String(Number(original) + 100));
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
    await page.keyboard.press("Control+s");
    await expect(toast(page, "Changes saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Price").first()).toHaveValue(String(Number(original) + 100));
    await page.getByLabel("Price").first().fill("1");
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByLabel("Price").first()).toHaveValue(String(Number(original) + 100));
  });

  test("optimistic concurrency: a stale editor can't overwrite newer changes", async ({ page, browser }) => {
    await page.goto("/admin/products?search=snowfoam");
    await productRows(page).first().click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(/SnowFoam/);
    const url = page.url();
    const ctx = await contextAs(browser, "staff");
    const other = await ctx.newPage();
    await other.goto(url);
    await other.getByLabel("Sort position").fill("7");
    await other.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(other, "Changes saved")).toBeVisible();
    await ctx.close();

    await page.getByLabel("Sort position").fill("9");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).filter({ hasText: "changed by someone else" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Reload latest" }).click();
    await expect(page.getByLabel("Sort position")).toHaveValue("7");
    await page.getByLabel("Sort position").fill("9");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page, "Changes saved")).toBeVisible();
  });

  test("image upload, reorder and delete", async ({ page }, testInfo) => {
    await page.goto("/admin/products?search=gripdash");
    await productRows(page).first().click();
    const images = page.getByRole("heading", { name: "Images" }).locator("xpath=ancestor::section[1]").locator("ul li img");
    await expect(images.first()).toBeVisible(); // editor loaded
    const before = await images.count();
    const file = testInfo.outputPath("upload.png");
    await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 30, g: 90, b: 160 } } }).png().toFile(file);
    await page.getByLabel("Upload images").setInputFiles(file);
    await expect(images).toHaveCount(before + 1);
    await expect(images.last()).toHaveAttribute("src", /\.webp$/);
    // move the new image to the front (cover)
    for (let i = 0; i < before; i++) {
      await page.getByRole("button", { name: "Move image earlier" }).last().click();
    }
    await expect(images.first()).toHaveAttribute("src", /\/uploads\//);
    page.once("dialog", () => undefined);
    await page.getByRole("button", { name: "Delete image" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(images).toHaveCount(before);
  });

  test("rejects a file that isn't really an image", async ({ page }) => {
    await page.goto("/admin/products?search=gripdash");
    await productRows(page).first().click();
    await page.getByLabel("Upload images").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<html>nope</html>") });
    await expect(toast(page, "Couldn't upload fake.png")).toBeVisible();
  });

  test("bulk: move to draft, then archive with undo", async ({ page }) => {
    await page.goto("/admin/products?status=active&sort=name&dir=asc");
    await expect(productRows(page).first()).toBeVisible();
    const names = (await productRows(page).locator("td:nth-child(2) span.font-medium").allInnerTexts()).slice(0, 2);
    await productRows(page).nth(0).getByRole("checkbox").click();
    await productRows(page).nth(1).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Move to draft" }).click();
    await expect(toast(page, "2 products moved to draft")).toBeVisible();
    await page.getByRole("tab", { name: "Draft" }).click();
    for (const n of names) await expect(productRows(page).filter({ hasText: n })).toBeVisible();
    // restore
    await productRows(page).filter({ hasText: names[0] }).getByRole("checkbox").click();
    await productRows(page).filter({ hasText: names[1] }).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(toast(page, "2 products published")).toBeVisible();

    // archive one from the row menu, then undo
    await page.goto("/admin/products?status=active&sort=name&dir=asc");
    await productRows(page).first().getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
    await expect(toast(page, "Product archived")).toBeVisible();
    await toast(page, "Product archived").getByRole("button", { name: "Undo" }).click();
    await expect(toast(page, "restored")).toBeVisible();
    await page.reload();
    await expect(productRows(page).first()).toContainText(names[0]);
  });
});

test.describe("inventory", () => {
  test("inline edits are reviewed and saved together, then show in the ledger", async ({ page }) => {
    await page.goto("/admin/inventory?sort=sku&dir=asc");
    const table = page.getByRole("table", { name: "Inventory" });
    const r0 = table.locator("tbody tr[data-row]").nth(0);
    const r1 = table.locator("tbody tr[data-row]").nth(1);
    const in0 = r0.getByRole("textbox");
    const in1 = r1.getByRole("textbox");
    const v0 = Number(await in0.inputValue());
    const v1 = Number(await in1.inputValue());
    await in0.fill(String(v0 + 10));
    await in1.fill(String(v1 + 3));
    await expect(page.getByRole("region", { name: "Unsaved stock changes" })).toContainText("2 unsaved changes");
    await page.getByRole("button", { name: "Review & save" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText("+10");
    await expect(dlg).toContainText("+3");
    await pick(page, "Reason", "Restock");
    await dlg.getByLabel("Note").fill("E2E delivery");
    await dlg.getByRole("button", { name: "Save 2 changes" }).click();
    await expect(toast(page, "Stock updated")).toBeVisible();
    await expect(in0).toHaveValue(String(v0 + 10));
    await page.goto("/admin/inventory?tab=ledger&reason=restock");
    await expect(page.getByRole("table", { name: "Stock movements" }).locator("tbody tr").filter({ hasText: "E2E delivery" })).toHaveCount(2);
  });

  test("discarding edits restores the values; Escape reverts one field", async ({ page }) => {
    await page.goto("/admin/inventory?sort=sku&dir=asc");
    const input = page.getByRole("table", { name: "Inventory" }).locator("tbody tr[data-row]").nth(2).getByRole("textbox");
    const v = await input.inputValue();
    await input.fill("999");
    await input.press("Escape");
    await expect(input).toHaveValue(v);
    await input.fill("998");
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(input).toHaveValue(v);
  });

  test("adjust dialog prevents removing more than on hand", async ({ page }) => {
    await page.goto("/admin/inventory?stock=low");
    const row = page.getByRole("table", { name: "Inventory" }).locator("tbody tr[data-row]").first();
    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Adjust stock…" }).click();
    const dlg = page.getByRole("dialog", { name: "Adjust stock" });
    await dlg.getByRole("radio", { name: "Remove" }).click();
    await dlg.getByLabel("Quantity").fill("9999");
    await expect(dlg.getByRole("button", { name: "Save" })).toBeDisabled();
    await dlg.getByRole("radio", { name: "Add" }).click();
    await expect(dlg.getByRole("button", { name: "Save" })).toBeEnabled();
    await dlg.getByRole("button", { name: "Save" }).click();
    await expect(toast(page, /Stock updated/)).toBeVisible();
  });

  test("summary cards filter the list", async ({ page }) => {
    await page.goto("/admin/inventory");
    await page.getByRole("button", { name: /^\d+$/ }).last().click();
    await expect(page).toHaveURL(/stock=out/);
    const badges = await page.getByRole("table", { name: "Inventory" }).locator("tbody tr[data-row]").count();
    expect(badges).toBeGreaterThan(0);
  });
});

test.describe("categories", () => {
  test("create, edit and delete an empty category; non-empty ones can't be deleted", async ({ page }) => {
    const slug = `e2e-${stamp()}`;
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "New category" }).click();
    const drawer = page.getByRole("dialog", { name: "New category" });
    await drawer.getByRole("button", { name: "Create category" }).click();
    await expect(drawer.getByText("Required").first()).toBeVisible();
    await drawer.getByLabel("Name", { exact: true }).fill("Accessoires E2E");
    await drawer.getByLabel("Short name").fill("Accessoires");
    await drawer.getByLabel("Slug").fill(slug);
    await drawer.getByRole("button", { name: "Create category" }).click();
    await expect(toast(page, "Category created")).toBeVisible();
    const row = page.getByRole("table", { name: "Categories" }).locator("tbody tr").filter({ hasText: slug });
    await expect(row).toContainText("Active");
    await row.click();
    await page.getByRole("dialog").getByRole("switch", { name: "Visible on the store" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(row).toContainText("Hidden");
    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(toast(page, "Category deleted")).toBeVisible();
    await expect(row).toHaveCount(0);

    const full = page.getByRole("table", { name: "Categories" }).locator("tbody tr").filter({ hasText: "vision" });
    await full.getByRole("button", { name: "Row actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("aria-disabled", "true");
  });
});
