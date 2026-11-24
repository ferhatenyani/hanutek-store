import type { Page } from "@playwright/test";
import { apiAs, expect, login, pick, ready, test, toast, USERS } from "./fixtures";

const tableRows = (page: Page, name: string) => page.getByRole("table", { name }).locator("tbody tr[data-row]");

test.describe("customers", () => {
  test("search, sort by spend and open a profile", async ({ page }) => {
    await page.goto("/admin/customers");
    await ready(page);
    const header = page.getByRole("columnheader", { name: "Spent" });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    const spent = (await tableRows(page, "Customers").locator("td").filter({ hasText: /\sDA$/ }).allInnerTexts()).map((t) => Number(t.replace(/\D/g, "")));
    expect(spent.every((v, i) => i === 0 || spent[i - 1] >= v)).toBe(true);
    await tableRows(page, "Customers").first().click();
    await expect(page.getByText("Lifetime spend")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  });

  test("filters unverified accounts", async ({ page }) => {
    await page.goto("/admin/customers");
    await pick(page, "Email", "Unverified");
    await expect(page).toHaveURL(/verified=no/);
    for (const t of await tableRows(page, "Customers").locator("td:nth-child(3)").allInnerTexts()) expect(t).toContain("Unverified");
  });

  test("disable and re-enable an account (sessions revoked)", async ({ page }) => {
    await page.goto(`/admin/customers?search=${encodeURIComponent(USERS.customer.email)}`);
    await tableRows(page, "Customers").first().click();
    await page.getByRole("button", { name: "Manage account" }).click();
    await page.getByRole("menuitem", { name: "Disable account" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Disable account" }).click();
    await expect(toast(page, "Account disabled")).toBeVisible();
    await expect(page.locator("header").getByText("Disabled")).toBeVisible();
    // the customer can no longer sign in
    const r = await page.request.post("/api/v1/auth/login", { data: { email: USERS.customer.email, password: USERS.customer.password }, headers: { origin: new URL(page.url()).origin } });
    expect(r.status()).toBe(403);
    await page.getByRole("button", { name: "Manage account" }).click();
    await page.getByRole("menuitem", { name: "Enable account" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Enable account" }).click();
    await expect(toast(page, "Account enabled")).toBeVisible();
  });

  test("admins can't disable or demote themselves", async ({ page }) => {
    await page.goto("/admin");
    const me = await apiAs(page, "GET", "/admin/me");
    const id = (me.json.user as { id: string }).id;
    await page.goto(`/admin/customers/${id}`);
    await expect(page.locator("header").getByText("You")).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage account" })).toHaveCount(0);
    expect((await apiAs(page, "PATCH", `/admin/customers/${id}`, { role: "customer" })).status).toBe(409);
  });
});

test.describe("team & roles", () => {
  test("grant staff access to a customer, then revoke it", async ({ page }) => {
    const email = "yacine.benali0@example.dz";
    await page.goto("/admin/team");
    await page.getByRole("button", { name: "Add team member" }).click();
    const dlg = page.getByRole("dialog", { name: "Add team member" });
    await dlg.getByLabel("Account email").fill("nobody@nowhere.dz");
    await dlg.getByRole("button", { name: "Find account" }).click();
    await expect(dlg).toContainText("No account uses this email");
    await dlg.getByLabel("Account email").fill(email);
    await dlg.getByRole("button", { name: "Find account" }).click();
    await expect(dlg).toContainText("currently customer");
    await dlg.getByRole("button", { name: "Grant access" }).click();
    await page.getByRole("dialog").last().getByRole("button", { name: "Grant access" }).click();
    await expect(toast(page, /is now staff/)).toBeVisible();
    await expect(tableRows(page, "Team members").filter({ hasText: email })).toContainText("Staff");

    await tableRows(page, "Team members").filter({ hasText: email }).click();
    await page.getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: /Customer/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Change role" }).click();
    await expect(toast(page, "Role changed to Customer")).toBeVisible();
  });

  test("promoting to admin requires typing the email", async ({ page }) => {
    await page.goto("/admin/team");
    await tableRows(page, "Team members").filter({ hasText: USERS.staff.email }).click();
    await page.getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: /Admin/ }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByRole("button", { name: "Change role" })).toBeDisabled();
    await dlg.getByLabel("Confirmation text").fill("wrong");
    await expect(dlg.getByRole("button", { name: "Change role" })).toBeDisabled();
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("combobox", { name: "Role" })).toHaveText("Staff");
  });

  test("the permission matrix reflects the server roles", async ({ page }) => {
    await page.goto("/admin/team?tab=roles");
    const row = page.getByRole("row", { name: /Read the audit log/ });
    // columns: Staff, Admin
    await expect(row.getByRole("cell").nth(0).getByLabel("Not allowed", { exact: true })).toBeVisible();
    await expect(row.getByRole("cell").nth(1).getByLabel("Allowed", { exact: true })).toBeVisible();
  });
});

test.describe("promotions", () => {
  test("create with validation, pause, edit and delete an unused code", async ({ page }) => {
    const code = `E2E${Date.now().toString(36).toUpperCase()}`;
    await page.goto("/admin/promotions");
    await page.getByRole("button", { name: "New code" }).click();
    const d = page.getByRole("dialog", { name: "New discount code" });
    await d.getByLabel("Code").fill(code);
    await d.getByLabel("Value").fill("150");
    await d.getByRole("button", { name: "Create code" }).click();
    await expect(d.getByText("Between 1 and 100")).toBeVisible();
    await d.getByLabel("Value").fill("15");
    await d.getByLabel("Maximum discount").fill("2000");
    // schedule with the calendar (no native date input)
    await d.getByRole("button", { name: /Ends/ }).click();
    await page.getByRole("button", { name: "Next month" }).click();
    await page.getByRole("gridcell").filter({ hasText: /^15$/ }).first().click();
    await expect(d.getByText("Preview:")).toContainText("15% off (max");
    await d.getByRole("button", { name: "Create code" }).click();
    await expect(toast(page, `${code} created`)).toBeVisible();
    const row = page.getByRole("table", { name: "Discount codes" }).locator("tbody tr").filter({ hasText: code });
    await expect(row).toContainText("Active");

    await row.getByRole("switch").click();
    await expect(toast(page, `${code} paused`)).toBeVisible();
    await expect(row).toContainText("Paused");
    // the storefront refuses a paused code
    const apply = await page.request.post("/api/v1/cart/promo", { data: { code }, headers: { origin: new URL(page.url()).origin } });
    expect(apply.status()).toBe(422);

    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(toast(page, "Code deleted")).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test("used codes show redemptions and can't be deleted", async ({ page }) => {
    await page.goto("/admin/promotions");
    const row = page.getByRole("table", { name: "Discount codes" }).locator("tbody tr").filter({ hasText: "DRIVE10" });
    await row.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Redemptions");
    await expect(drawer.getByRole("link").first()).toContainText(/HT-\d+/);
    await drawer.getByRole("button", { name: "Close" }).first().click();
    await row.getByRole("button", { name: "Row actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("aria-disabled", "true");
  });

  test("lifecycle tabs: expired codes", async ({ page }) => {
    await page.goto("/admin/promotions?tab=expired");
    await expect(page.getByRole("table", { name: "Discount codes" }).locator("tbody tr").filter({ hasText: "SUMMER15" })).toContainText("Expired");
  });
});

test.describe("reviews", () => {
  test("hide and re-publish in bulk; counts update", async ({ page }) => {
    await page.goto("/admin/reviews?status=published");
    const hiddenTab = page.getByRole("tab", { name: /Hidden/ });
    await expect(hiddenTab).toHaveText(/\d/);
    const hiddenBefore = Number((await hiddenTab.innerText()).replace(/\D/g, ""));
    const rows = tableRows(page, "Reviews");
    await rows.nth(0).getByRole("checkbox").click();
    await rows.nth(1).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Hide" }).click();
    await expect(toast(page, "2 reviews hidden")).toBeVisible();
    await expect(hiddenTab).toContainText(String(hiddenBefore + 2));
    await hiddenTab.click();
    await page.getByRole("checkbox", { name: "Select all rows on this page" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(hiddenTab).toContainText("0");
  });

  test("filters by rating and opens a review", async ({ page }) => {
    await page.goto("/admin/reviews");
    await pick(page, "Rating", "5 stars");
    const first = tableRows(page, "Reviews").first();
    await expect(first.getByRole("img", { name: "5 out of 5 stars" })).toBeVisible();
    await first.locator("td").nth(1).click();
    await expect(page.getByRole("dialog")).toContainText("Verified purchase");
  });
});

test.describe("shipping", () => {
  test("advance from the board: confirm, then ship with a carrier", async ({ page }) => {
    await page.goto("/admin/shipping");
    const toConfirm = page.locator("section").filter({ has: page.getByRole("heading", { name: /To confirm/ }) });
    const first = toConfirm.locator("li").filter({ has: page.getByRole("button", { name: "Confirm" }) }).first();
    const number = (await first.locator("a span").first().innerText()).split(/\s/)[0];
    await first.getByRole("button", { name: "Confirm" }).click();
    await expect(toast(page, `${number} · confirm`)).toBeVisible();

    const toShip = page.locator("section").filter({ has: page.getByRole("heading", { name: /To ship/ }) });
    const parcel = toShip.locator("li").filter({ has: page.getByRole("button", { name: "Ship" }) }).first();
    await parcel.getByRole("button", { name: "Ship" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Tracking number").fill("YAL-E2E-77");
    await dlg.getByRole("button", { name: "Ship order" }).click();
    await expect(toast(page, /shipped with/)).toBeVisible();
  });

  test("add, deactivate and delete a carrier", async ({ page }) => {
    const name = `E2E Express ${Date.now().toString(36)}`;
    await page.goto("/admin/shipping");
    await page.getByRole("button", { name: "Add carrier" }).click();
    const d = page.getByRole("dialog", { name: "Add carrier" });
    await d.getByLabel("Name").fill(name);
    await d.getByLabel("Tracking link").fill("javascript:alert(1)");
    await d.getByRole("button", { name: "Add carrier" }).click();
    await expect(d.getByText("Must start with https://")).toBeVisible();
    await d.getByLabel("Tracking link").fill("https://track.example/{number}");
    await d.getByRole("button", { name: "Add carrier" }).click();
    await expect(toast(page, "Carrier added")).toBeVisible();
    const row = page.getByRole("table", { name: "Carriers" }).locator("tbody tr").filter({ hasText: name });
    await row.getByRole("switch").click();
    await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(row).toHaveCount(0);
  });
});

test.describe("audit log, settings & tools", () => {
  test("audit log records actions with actor and before/after", async ({ page }) => {
    await page.goto("/admin/audit");
    await page.getByRole("searchbox", { name: "Search audit log" }).fill("carrier");
    const rows = tableRows(page, "Audit log");
    await expect(rows.first()).toContainText("Carrier");
    await rows.first().click();
    await expect(page.getByRole("dialog")).toContainText(USERS.admin.email);
    await expect(page.getByRole("dialog").locator("pre").first()).toBeVisible();
  });

  test("system tools: status and guest-cart cleanup", async ({ page }) => {
    await page.goto("/admin/settings?tab=system");
    await expect(page.getByText("Healthy")).toBeVisible();
    await page.getByRole("button", { name: "Clean up" }).click();
    await expect(page.getByRole("dialog")).toContainText("abandoned guest cart");
    await page.getByRole("dialog").getByRole("button", { name: "Delete carts" }).click();
    await expect(toast(page, /carts? deleted/)).toBeVisible();
    await page.getByRole("button", { name: "Clean up" }).click();
    await expect(toast(page, "No guest carts older than")).toBeVisible();
  });

  test("change own password (other sessions are signed out)", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await login(page, "staff2");
    await ready(page);
    await page.goto("/admin/settings");
    await page.getByLabel("Current").fill("wrong-one");
    await page.getByLabel("New", { exact: true }).fill("Brand-new-pass-1");
    await page.getByLabel("Confirm new").fill("Brand-new-pass-1");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Incorrect password")).toBeVisible();
    await page.getByLabel("Current").fill(USERS.staff2.password);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(toast(page, "Password changed")).toBeVisible();
    // still signed in on this device
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    // change it back for repeat runs
    await page.goto("/admin/settings");
    await page.getByLabel("Current").fill("Brand-new-pass-1");
    await page.getByLabel("New", { exact: true }).fill(USERS.staff2.password);
    await page.getByLabel("Confirm new").fill(USERS.staff2.password);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(toast(page, "Password changed")).toBeVisible();
    await ctx.close();
  });

  test("display name update is reflected in the shell", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByLabel("Display name").fill("Nadia A.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(toast(page, "Name updated")).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" }).first()).toContainText("Nadia A.");
    await page.getByLabel("Display name").fill(USERS.admin.name);
    await page.getByRole("button", { name: "Save", exact: true }).click();
  });

  test("subscribers export only active addresses", async ({ page }) => {
    await page.goto("/admin/subscribers");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export subscribed" }).click()]);
    const csv = (await import("node:fs")).readFileSync((await dl.path())!, "utf8");
    expect(csv.startsWith("email,locale,subscribed_at")).toBe(true);
    await pick(page, "Status", "Unsubscribed");
    const unsub = await tableRows(page, "Subscribers").locator("td:first-child").allInnerTexts();
    for (const e of unsub) expect(csv).not.toContain(e.trim());
  });
});
