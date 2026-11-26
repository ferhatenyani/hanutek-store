import type { Page } from "@playwright/test";
import { test, expect, ready, apiAs } from "./fixtures";

/**
 * The console is French-only. Every page, plus its menus, dialogs and drawers,
 * is scanned for English UI words — in visible text and in the accessible
 * attributes screen readers announce (aria-label, placeholder, title).
 *
 * Product names are brand names (e.g. "RoadEye Dual Dash Cam") and stay as
 * they are: the word list only contains interface vocabulary.
 */
const ENGLISH =
  /\b(Save|Cancel|Delete|Search|Settings|Overview|Loading|Couldn|Inventory|Shipping|Reviews|Subscribers|Payment|Create|Clear|Filters?|Showing|Export|Columns|Rows|Sign (in|out)|Account|Theme|Previous|Next|Close|Open|View|Edit|Add|Remove|Products?|Discount|Region|Carrier|Tracking|Pending|Shipped|Delivered|Cancelled|Returned|Draft|Archived|Unpaid|Paid|Refunded|Customers?|Staff|Role|Permissions?|Today|Yesterday|just now|ago|Out of stock|Low stock|Units|Sales|Orders?|Status|Select|Choose|Enter|Back|Done|None|Nothing|Something went wrong|Try again|Reset|Publish|Hide|Hidden|Inactive|Disabled|Verified|Unverified|Joined|Spent|Last|Since|Language|Arabic|French|Sold|Price|Name|Category|Categories|Rating|Updated|Created|Reason|Change|Balance|Item|Who|When|Target|Device|Actor|Profile|Password|Appearance|Light|Dark|System|Housekeeping|Healthy|Shortcuts?|Keyboard|Command|Members|Grant|Find|Team|Audit|log|Gross|Average|Needs attention|Top products|Recent|Activity|Collected|Cash|per day|selected|of \d)\b/;

async function englishOn(page: Page) {
  return page.evaluate((src) => {
    const re = new RegExp(src);
    const hits = new Set<string>();
    const root = document.querySelector(".adm") ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest("script,style,[hidden],[aria-hidden=true]")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // data cells that hold product names / customer free text are not UI copy
      if (el.closest("[data-user-content]")) continue;
      const t = (n.textContent ?? "").trim();
      if (t && re.test(t)) hits.add(`text: ${t.slice(0, 80)}`);
    }
    for (const el of root.querySelectorAll("[aria-label],[placeholder],[title]")) {
      for (const a of ["aria-label", "placeholder", "title"]) {
        const v = el.getAttribute(a);
        if (v && re.test(v)) hits.add(`${a}: ${v.slice(0, 80)}`);
      }
    }
    return [...hits];
  }, ENGLISH.source);
}

/** Product / brand names from the catalogue are allowed to be English. */
async function brandNames(page: Page): Promise<string[]> {
  const r = await apiAs(page, "GET", "/admin/products?pageSize=100");
  return ((r.json.items as { name: string }[]) ?? []).map((p) => p.name);
}

test("every console page, menu and dialog is in French", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/admin");
  await ready(page);
  const brands = await brandNames(page);
  const order = ((await apiAs(page, "GET", "/admin/orders?pageSize=1")).json.items as { number: string }[])[0].number;
  const customer = ((await apiAs(page, "GET", "/admin/customers?pageSize=1")).json.items as { id: string }[])[0].id;
  const product = ((await apiAs(page, "GET", "/admin/products?pageSize=1")).json.items as { id: string }[])[0].id;

  const pages = [
    "/admin", "/admin/orders", `/admin/orders/${order}`, "/admin/shipping", "/admin/customers", `/admin/customers/${customer}`,
    "/admin/promotions", "/admin/products", "/admin/products/new", `/admin/products/${product}`, "/admin/inventory",
    "/admin/inventory?tab=ledger", "/admin/categories", "/admin/reviews", "/admin/subscribers", "/admin/team", "/admin/team?tab=roles",
    "/admin/audit", "/admin/settings", "/admin/settings?tab=system", "/admin/this-page-does-not-exist",
  ];
  const problems: string[] = [];
  const scan = async (label: string) => {
    const hits = (await englishOn(page)).filter((h) => !brands.some((b) => h.includes(b) || b.includes(h.replace(/^\w+(-\w+)?: /, ""))));
    problems.push(...hits.map((h) => `${label} → ${h}`));
  };

  for (const url of pages) {
    await page.goto(url);
    await ready(page);
    await page.waitForLoadState("networkidle");
    await scan(url);
  }

  // overlays: command palette, shortcuts help, account menu, a row menu, a drawer, a confirm dialog
  await page.goto("/admin/orders");
  await ready(page);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Palette de commandes" })).toBeVisible();
  await page.keyboard.type("HT");
  await page.waitForLoadState("networkidle");
  await scan("command palette");
  await page.keyboard.press("Escape");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Raccourcis clavier" })).toBeVisible();
  await scan("shortcuts");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Menu du compte" }).first().click();
  await scan("account menu");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Actions de la ligne" }).first().click();
  await scan("row menu");
  await page.keyboard.press("Escape");
  await page.goto("/admin/promotions?new=1");
  await ready(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await scan("new promotion drawer");

  expect(problems, "English UI text in the French console").toEqual([]);
});
