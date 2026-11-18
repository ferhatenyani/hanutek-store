// Motion evidence harness: streams CDP screencast frames AROUND each
// interaction (still screenshots block during active view transitions),
// writes frames + per-case JSON facts, and assembles mp4 clips with ffmpeg.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const BASE = "http://localhost:3111";
const QA = "qa";

const clickByText = (page, sel, re) =>
  page.evaluate(([sel, source]) => {
    const rx = new RegExp(source, "i");
    const el = [...document.querySelectorAll(sel)].find(
      (b) => rx.test((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")),
    );
    el?.click();
    return Boolean(el);
  }, [sel, re]);

const lib = {
  // seed the cart with two products straight from the home rails
  prep_addTwo: async (page) => {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button[aria-label]")]
        .filter((b) => /au panier|add to cart|أضف إلى السلة/i.test(b.getAttribute("aria-label") || ""));
      btns.slice(0, 2).forEach((b) => b.click());
    });
    await page.waitForTimeout(700);
  },

  railToDetail: (page) =>
    page.evaluate(() => { void document.querySelector('a[href^="/products/"]')?.click(); }),

  detailToHome: (page) =>
    page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href="/"]')];
      (links.find((l) => l.closest("nav")) || links[0])?.click();
    }),

  homeToProducts: (page) =>
    page.evaluate(() => { void document.querySelector('a[href="/products"]')?.click(); }),

  productsToProfile: (page) =>
    page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href="/profile"]')].find((x) => !x.closest("footer"));
      a?.click();
    }),

  favoritesToProducts: (page) =>
    page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href="/products"]')].find((x) => !x.closest("footer"));
      a?.click();
    }),

  // A3 page: /cart summary "Checkout" CTA -> pure in-document scroll
  checkoutScroll: async (page) => {
    await page.goto("http://localhost:3111/cart", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const mounted = await page.evaluate(() => Boolean(document.getElementById("checkout")));
    await page.evaluate(() => { window.__noReload = (window.__noReload || 0) + 1; });
    const before = await page.evaluate(() => ({ y: Math.round(scrollY), url: location.href, marker: window.__noReload }));
    const clicked = await clickByText(page, "main button", "commander|checkout|passer|الدفع|إتمام");
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({ y: Math.round(scrollY), url: location.href, marker: window.__noReload }));
    return { formAlreadyMounted: mounted, ctaClicked: clicked, scrollBefore: before, scrollAfter: after };
  },

  // A3 sheet (mobile/tablet): open -> expand -> scroll the sheet itself
  sheetCheckout: async (page) => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button[aria-label]")]
        .find((x) => /^panier|cart|سلة/i.test(x.getAttribute("aria-label") || ""));
      b?.click();
    });
    await page.waitForTimeout(750);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")]
        .find((x) => /voir le panier|view full|عرض السلة/i.test(x.textContent || ""));
      b?.click();
    });
    await page.waitForTimeout(800);
    const has = await page.evaluate(() => Boolean(document.getElementById("sheet-checkout")));
    const topBefore = await page.evaluate(() => {
      const c = document.getElementById("sheet-checkout")?.closest(".overflow-y-auto");
      return c ? Math.round(c.scrollTop) : -1;
    });
    const clicked = await clickByText(page, "button", "^(passer commande|checkout|commander|إتمام|الدفع)");
    await page.waitForTimeout(900);
    const topAfter = await page.evaluate(() => {
      const c = document.getElementById("sheet-checkout")?.closest(".overflow-y-auto");
      return { top: c ? Math.round(c.scrollTop) : -1, url: location.href, marker: window.__noReload };
    });
    return { sheetFormMountedBeforeClick: has, clicked, sheetScrollBefore: topBefore, sheetScrollAfter: topAfter };
  },

  hardwareBack: async (page) => {
    await page.evaluate(() => { void document.querySelector('a[href="/products"]')?.click(); });
    await page.waitForTimeout(900);
    void page.goBack();
    await page.waitForTimeout(60);
    const dn = await page.evaluate(() => document.documentElement.dataset.nav || null);
    return { dataNavDuringPop: dn };
  },
};

const probes = {
  detail: (page) => page.evaluate(() => ({ url: location.href, heroImg: Boolean(document.querySelector("main img")) })),
  products: (page) => page.evaluate(() => ({ url: location.href, grid: Boolean(document.querySelector(".product-grid")) })),
  profile: (page) => page.evaluate(() => ({ url: location.href })),
  cart: (page) => page.evaluate(() => ({ url: location.href, formBelowCart: Boolean(document.getElementById("checkout")) })),
  home: (page) => page.evaluate(() => ({ url: location.href })),
  reducedPixel: (page) =>
    page.evaluate(() => {
      const img = document.querySelector("main img");
      if (!img) return { hero: "missing" };
      const c = document.createElement("canvas");
      c.width = c.height = 4;
      const x = c.getContext("2d");
      try { x.drawImage(img, 0, 0, 4, 4); } catch { return { hero: "cors" }; }
      const d = x.getImageData(0, 0, 4, 4).data;
      return { heroSample: [d[0], d[1], d[2]], loaded: img.complete && img.naturalWidth > 0 };
    }),
};

async function record(page, name, fn, settleMs = 1150) {
  const dir = join(QA, name);
  mkdirSync(dir, { recursive: true });
  const client = await page.context().newCDPSession(page);
  await client.send("Page.enable");
  const frames = [];
  client.on("Page.screencastFrame", async ({ data, sessionId }) => {
    frames.push(data);
    try { await client.send("Page.screencastFrameAck", { sessionId }); } catch {}
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 62, everyNthFrame: 1 });
  await page.waitForTimeout(200);
  const out = await fn();
  await page.waitForTimeout(settleMs);
  await client.send("Page.stopScreencast");
  frames.forEach((d, i) => writeFileSync(join(dir, `frame_${String(i).padStart(3, "0")}.jpg`), Buffer.from(d, "base64")));
  try {
    execSync(`ffmpeg -y -loglevel error -framerate 15 -i "${join(dir, "frame_%03d.jpg")}" -c:v libx264 -pix_fmt yuv420p -crf 26 "${join(QA, name + ".mp4")}"`);
  } catch {}
  return { frames: frames.length, ...(out || {}) };
}

async function main() {
  const cases = JSON.parse(process.argv[2] || "[]");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    channel: undefined,
  });
  const results = [];
  for (const c of cases) {
    const ctx = await browser.newContext({
      viewport: { width: c.w, height: c.h },
      reducedMotion: c.reduced ? "reduce" : "no-preference",
    });
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ["hanutek-locale", c.locale]);
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    try {
      await page.goto(`${BASE}${c.from}`, { waitUntil: "networkidle" });
      await page.evaluate(() => { window.__noReload = (window.__noReload || 0) + 1; });
      if (c.prep) await lib[c.prep](page);
      const rec = await record(page, c.name, () => lib[c.act](page), c.settle);
      const facts = await probes[c.probe](page);
      await page.screenshot({ path: join(QA, c.name + "_after.png") });
      results.push({ case: c.name, ...rec, ...facts, errors: errs });
    } catch (e) {
      results.push({ case: c.name, failed: String(e).slice(0, 220), errors: errs });
    }
    await ctx.close();
  }
  writeFileSync(join(QA, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
