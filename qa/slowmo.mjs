// Slow-motion proof capture: identical CSS, animation-duration stretched to
// 4s via an injected test stylesheet (source untouched), so screencast
// frames land mid-flight and the actual keyframe visuals are verifiable.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const BASE = "http://localhost:3111";

const cases = JSON.parse(process.argv[2] || "[]");

const b = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const results = [];
for (const c of cases) {
  const ctx = await b.newContext({ viewport: { width: c.w, height: c.h } });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ["hanutek-locale", c.locale]);
  const p = await ctx.newPage();
  await p.goto(`${BASE}${c.from}`, { waitUntil: "networkidle" });
  await p.addStyleTag({
    content: `@layer qa {
      ::view-transition-old(root), ::view-transition-new(root) { animation-duration: 4000ms !important; }
      ::view-transition-group(.morph) { animation-duration: 4000ms !important; }
    }`,
  });
  if (c.prep) {
    await p.evaluate(() => {
      [...document.querySelectorAll("button[aria-label]")]
        .filter((b) => /au panier|add to cart|أضف إلى السلة/i.test(b.getAttribute("aria-label") || ""))
        .slice(0, 2).forEach((x) => x.click());
    });
    await p.waitForTimeout(600);
  }

  const dir = join("qa", c.name);
  mkdirSync(dir, { recursive: true });
  const client = await p.context().newCDPSession(p);
  await client.send("Page.enable");
  const frames = [];
  client.on("Page.screencastFrame", async ({ data, sessionId }) => {
    frames.push(data);
    try { await client.send("Page.screencastFrameAck", { sessionId }); } catch {}
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
  await p.waitForTimeout(300);
  if (c.setup) {
    // e.g. push to /products first (slowly), then the recorded act is back
    await p.evaluate(() => document.querySelector('a[href="/products"]').click());
    await p.waitForTimeout(4600);
  }
  await p.evaluate((act) => {
    if (act === "rail") document.querySelector('a[href^="/products/"]').click();
    if (act === "tabs") document.querySelector('a[href="/products"]').click();
    if (act === "back") window.history.back();
  }, c.act);
  await p.waitForTimeout(4900);
  await client.send("Page.stopScreencast");
  frames.forEach((d, i) => writeFileSync(join(dir, `frame_${String(i).padStart(3, "0")}.jpg`), Buffer.from(d, "base64")));
  try {
    execSync(`ffmpeg -y -loglevel error -framerate 10 -i "${join(dir, "frame_%03d.jpg")}" -c:v libx264 -pix_fmt yuv420p -crf 25 "${join("qa", c.name + ".mp4")}"`);
  } catch {}
  results.push({ case: c.name, frames: frames.length, url: p.url() });
  await ctx.close();
}

// back-pop variant: push first (no recording), then pop inside recording
await b.close();
console.log(JSON.stringify(results, null, 1));
