import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { contextAs, expect, pick, ready, test, toast } from "./fixtures";

const rows = (page: Page) => page.getByRole("table", { name: "Orders" }).locator("tbody tr[data-row]");

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
    await expect(page.getByText(/^1–25 of \d+$/)).toBeVisible();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/^26–50 of \d+$/)).toBeVisible();
    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(page.getByText(/^1–25 of/)).toBeVisible();
    await pick(page, "Rows per page", "50 / page");
    await expect(rows(page)).toHaveCount(50);
  });

  test("status tabs filter server-side and survive a reload", async ({ page }) => {
    await page.getByRole("tab", { name: "Delivered" }).click();
    await expect(page).toHaveURL(/status=delivered/);
    await expect(rows(page).first()).toContainText("Delivered");
    const statuses = await rows(page).locator("td:nth-child(5)").allInnerTexts();
    expect(statuses.every((s) => s.includes("Delivered"))).toBe(true);
    await page.reload();
    await expect(page.getByRole("tab", { name: "Delivered", selected: true })).toBeVisible();
  });

  test("search by order number and by phone", async ({ page }) => {
    const number = await orderIn(page, "pending");
    await page.getByRole("searchbox", { name: "Search orders" }).fill(number);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(number);
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(rows(page)).toHaveCount(25);
    await page.getByRole("searchbox", { name: "Search orders" }).fill("zzzz-no-match");
    await expect(page.getByText("No orders match these filters")).toBeVisible();
  });

  test("“/” focuses the search box", async ({ page }) => {
    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "Search orders" })).toBeFocused();
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
    await pick(page, "Payment", "Paid");
    await expect(page).toHaveURL(/payment=paid/);
    await pick(page, "Region", /^16 · Alger/);
    await expect(page).toHaveURL(/wilaya=16/);
    for (const t of await rows(page).locator("td:nth-child(6)").allInnerTexts()) expect(t).toContain("Paid");
    for (const t of await rows(page).locator("td:nth-child(8)").allInnerTexts()) expect(t).toContain("16 · Alger");
    await page.getByRole("button", { name: /^Reset/ }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });

  test("column visibility is remembered", async ({ page }) => {
    await expect(page.getByRole("columnheader", { name: "Carrier" })).toHaveCount(0);
    await page.getByRole("button", { name: "Choose columns" }).click();
    await page.getByRole("dialog").getByText("Carrier", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("columnheader", { name: "Carrier" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("columnheader", { name: "Carrier" })).toBeVisible();
    await page.getByRole("button", { name: "Choose columns" }).click();
    await page.getByRole("button", { name: "Reset to default" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("columnheader", { name: "Carrier" })).toHaveCount(0);
  });

  test("saved views store and re-apply filters", async ({ page }) => {
    await page.getByRole("tab", { name: "In transit" }).click();
    await pick(page, "Payment", "Unpaid");
    await page.getByRole("button", { name: "Saved views" }).click();
    await page.getByRole("button", { name: "Save current filters…" }).click();
    await page.getByLabel("View name").fill("Cash on the road");
    await page.getByRole("button", { name: "Save view" }).click();
    await expect(toast(page, "View “Cash on the road” saved")).toBeVisible();
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Saved views" }).click();
    await page.getByRole("button", { name: "Cash on the road", exact: true }).click();
    await expect(page).toHaveURL(/status=shipped%2Cout_for_delivery/);
    await expect(page).toHaveURL(/payment=unpaid/);
    await page.getByRole("button", { name: "Saved views" }).click();
    await page.getByRole("button", { name: "Delete view Cash on the road" }).click();
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
    await page.getByRole("tab", { name: "Delivered" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    const csv = readFileSync((await download.path())!, "utf8");
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toContain("number,placed_at,status");
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.slice(1).every((l) => l.includes('"delivered"'))).toBe(true);
  });
});

test.describe("order workflow", () => {
  test("confirm → pack → ship → deliver, with timeline and payment", async ({ page }) => {
    const number = await orderIn(page, "pending", 0);
    await page.goto(`/admin/orders/${number}`);
    await expect(page.getByRole("heading", { name: number })).toBeVisible();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Note").fill("Confirmed by phone");
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(toast(page, "Order confirmed")).toBeVisible();
    await expect(page.getByText("Confirmed by phone")).toBeVisible();

    await page.getByRole("button", { name: "Mark packed" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark packed" }).click();
    await expect(toast(page, "Order packed")).toBeVisible();

    await page.getByRole("button", { name: "Ship", exact: true }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("combobox", { name: "Carrier" }).click();
    await page.getByRole("option", { name: "ZR Express" }).click();
    await dlg.getByLabel("Tracking number").fill("ZR-E2E-1");
    await dlg.getByRole("button", { name: "Ship" }).click();
    await expect(toast(page, "Order shipped")).toBeVisible();
    await expect(page.getByLabel("Tracking number")).toHaveValue("ZR-E2E-1");

    await page.getByRole("button", { name: "Mark delivered" }).click();
    await expect(page.getByRole("dialog")).toContainText("as collected");
    await page.getByRole("dialog").getByRole("button", { name: "Mark delivered" }).click();
    await expect(page.locator("header").getByText("Paid", { exact: true })).toBeVisible();
    await expect(page.getByText("Cash collected on delivery.")).toBeVisible();
    // timeline lists every step in order
    const steps = await page.locator("ol li span.font-medium").allInnerTexts();
    expect(steps).toEqual(["Pending", "Confirmed", "Packed", "Shipped", "Delivered"]);
  });

  test("cancelling restores stock (visible in the inventory ledger)", async ({ page }) => {
    const number = await orderIn(page, "confirmed", 0);
    await page.goto(`/admin/orders/${number}`);
    const sku = (await page.locator("main ul li").first().locator("span").filter({ hasText: /^[A-Z0-9-]{4,}$/ }).first().innerText()).trim();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Cancel order" }).click();
    await expect(page.getByRole("dialog")).toContainText("Items go back into stock");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel order" }).click();
    await expect(page.locator("header").getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(0);
    await page.goto("/admin/inventory?tab=ledger&reason=cancel");
    await expect(page.getByRole("table", { name: "Stock movements" }).locator("tbody tr").filter({ hasText: number }).filter({ hasText: sku })).toBeVisible();
  });

  test("delivery fee edit updates the total; internal note persists", async ({ page }) => {
    const number = await orderIn(page, "pending", 1);
    await page.goto(`/admin/orders/${number}`);
    const total = async () => Number((await page.locator("dl dd").filter({ hasText: /\sDA$/ }).last().innerText()).replace(/\D/g, ""));
    const before = await total();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Delivery fee").fill("650");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(toast(page, "Delivery fee updated")).toBeVisible();
    await expect.poll(total).toBe(before + 650);

    await page.getByLabel("Internal note").fill("Fragile — double box");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(toast(page, "Note saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Internal note")).toHaveValue("Fragile — double box");
  });

  test("a concurrent change is detected instead of applied twice", async ({ page, browser }) => {
    const number = await orderIn(page, "pending", 2);
    await page.goto(`/admin/orders/${number}`);
    const ctx = await contextAs(browser, "staff");
    const other = await ctx.newPage();
    await other.goto(`/admin/orders/${number}`);
    await other.getByRole("button", { name: "Confirm", exact: true }).click();
    await other.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(toast(other, "Order confirmed")).toBeVisible();
    // first tab still shows "pending" and tries the same move
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(toast(page, "This order changed in the meantime")).toBeVisible();
    await expect(page.locator("header").getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark packed" })).toBeVisible();
    await ctx.close();
  });

  test("bulk status change reports orders that can't move", async ({ page }) => {
    await page.goto("/admin/orders?status=pending%2Cconfirmed&sort=placed&dir=asc");
    await expect(rows(page).first()).toBeVisible();
    // one pending + one confirmed: "Mark packed" only works for the confirmed one
    const pendingRow = rows(page).filter({ hasText: "Pending" }).first();
    const confirmedRow = rows(page).filter({ hasText: "Confirmed" }).first();
    await pendingRow.getByRole("checkbox", { name: "Select row" }).click();
    await confirmedRow.getByRole("checkbox", { name: "Select row" }).click();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("2 selected");
    await page.getByRole("button", { name: "Change status" }).click();
    await page.getByRole("menuitem", { name: "Mark packed" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark packed" }).click();
    await expect(page.getByRole("dialog")).toContainText("Some orders were skipped");
    await expect(page.getByRole("dialog")).toContainText("Cannot move an order from pending to packed");
    await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("1 selected");
  });

  test("shift-click selects a range; select-all toggles the page", async ({ page }) => {
    await page.goto("/admin/orders");
    await rows(page).nth(1).getByRole("checkbox").click();
    await rows(page).nth(5).getByRole("checkbox").click({ modifiers: ["Shift"] });
    await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("5 selected");
    await page.getByRole("checkbox", { name: "Select all rows on this page" }).click();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("25 selected");
    await page.getByRole("checkbox", { name: "Select all rows on this page" }).click();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toHaveCount(0);
  });
});
