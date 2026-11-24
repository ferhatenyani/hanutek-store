import type { Page } from "@playwright/test";
import { expect, ready, test } from "./fixtures";

/**
 * Layout checks across phones, tablets, desktops and the exact Tailwind
 * breakpoint boundaries (sm 640, md 768, lg 1024, xl 1280) on either side.
 */
const VIEWPORTS = [
  { w: 320, h: 640 },
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 639, h: 900 },
  { w: 640, h: 900 },
  { w: 767, h: 1024 },
  { w: 768, h: 1024 },
  { w: 1023, h: 768 },
  { w: 1024, h: 768 },
  { w: 1279, h: 800 },
  { w: 1280, h: 800 },
  { w: 1920, h: 1080 },
];
const PAGES = ["/admin", "/admin/orders", "/admin/products", "/admin/inventory", "/admin/customers", "/admin/shipping", "/admin/promotions", "/admin/products/new"];

async function noHorizontalOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders = [...document.querySelectorAll<HTMLElement>("main *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // content inside a horizontally scrollable container is fine
        let p = el.parentElement;
        while (p && p !== document.body) {
          const s = getComputedStyle(p);
          if (/(auto|scroll|hidden)/.test(s.overflowX)) return false;
          p = p.parentElement;
        }
        return r.width > 0 && r.right > window.innerWidth + 1;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 60)}`);
    return { scroll: doc.scrollWidth - doc.clientWidth, offenders };
  });
  expect(overflow.scroll, `horizontal scroll on ${where}: ${overflow.offenders.join(", ")}`).toBeLessThanOrEqual(1);
}

for (const vp of VIEWPORTS) {
  test(`layout at ${vp.w}×${vp.h}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const path of PAGES) {
      await page.goto(path);
      await ready(page);
      await page.waitForLoadState("networkidle");
      await noHorizontalOverflow(page, `${path} @${vp.w}`);
      // navigation: sidebar from lg (1024), hamburger below
      if (vp.w >= 1024) {
        await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
      } else {
        await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
      }
      // tables become card lists below md (768)
      const table = page.locator("main table").first();
      if ((await table.count()) && path !== "/admin") {
        if (vp.w >= 768) await expect(table).toBeVisible();
        else await expect(table).toBeHidden();
      }
      // the page title is never covered by the sticky top bar
      const h1 = page.getByRole("heading", { level: 1 }).first();
      const bar = page.locator("header.sticky");
      if (await bar.isVisible()) {
        const [hb, bb] = [await h1.boundingBox(), await bar.boundingBox()];
        expect(hb!.y).toBeGreaterThanOrEqual(bb!.y + bb!.height - 1);
      }
    }
  });
}

test("mobile navigation drawer opens, navigates and closes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/admin");
  await ready(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("dialog", { name: "Navigation" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL(/\/admin\/orders/);
  await expect(nav).toHaveCount(0);
});

test("phone: order cards are tappable and the action menu stays inside the screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/admin/orders");
  const list = page.getByRole("list", { name: "Orders" });
  await expect(list).toBeVisible();
  const card = list.locator("li").first();
  const box = await card.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await card.getByRole("button", { name: "Row actions" }).click();
  const menu = page.getByRole("menu");
  const mb = await menu.boundingBox();
  expect(mb!.x).toBeGreaterThanOrEqual(0);
  expect(mb!.x + mb!.width).toBeLessThanOrEqual(360);
  await page.keyboard.press("Escape");
  await card.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/admin\/orders\/HT-/);
});

test("phone: dialogs become bottom sheets that fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/admin/promotions");
  await page.getByRole("button", { name: "New code" }).click();
  const sheet = page.getByRole("dialog", { name: "New discount code" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400); // let the slide-in finish before measuring
  const b = (await sheet.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.width).toBeLessThanOrEqual(375);
  expect(b.y + b.height).toBeLessThanOrEqual(667 + 1);
  // footer actions remain reachable
  await expect(sheet.getByRole("button", { name: "Create code" })).toBeInViewport();
});

test("tablet: wide tables scroll inside their card, not the page", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1100 });
  await page.goto("/admin/orders");
  await page.getByRole("button", { name: "Choose columns" }).click();
  for (const c of ["Carrier", "Promo"]) await page.getByRole("dialog").getByText(c, { exact: true }).click();
  await page.keyboard.press("Escape");
  await noHorizontalOverflow(page, "orders with all columns @800");
  await page.getByRole("button", { name: "Choose columns" }).click();
  await page.getByRole("button", { name: "Reset to default" }).click();
});
