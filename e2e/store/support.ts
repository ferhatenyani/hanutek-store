/**
 * Storefront E2E support: real backend, real database (the isolated E2E one),
 * no mocked API responses. Tests create their own customers, products and
 * promotions through the public / admin APIs so they are independent and
 * repeatable, and verify database state through the admin API (the embedded
 * database is owned by the server process).
 *
 * Only true externals are stand-ins: e-mail lands in a file outbox and Google
 * sign-in talks to a local OpenID provider (scripts/e2e-oidc-mock.mjs).
 */
import { test as base, expect, request as pwRequest, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { SignJWT } from "jose";

export const BASE = `http://localhost:${process.env.E2E_PORT ?? 3200}`;
export const OIDC = `http://localhost:${process.env.OIDC_PORT ?? 3299}`;
/** Fixed, test-only secret of the E2E server (scripts/e2e-server.mjs) — lets tests mint expired tokens. */
const E2E_JWT_SECRET = "e2e-only-secret-0123456789-0123456789-0123456789";
const OUTBOX = path.resolve(".data/e2e-outbox");
/** The E2E server runs NODE_ENV=production, so cookies carry the __Host-/__Secure- prefixes. */
export const COOKIES = { access: "__Host-ht_at", refresh: "__Secure-ht_rt", cart: "__Host-ht_cart" };
export const PASSWORD = "Shopper-pass-2026!";

let seq = 0;
/** Short unique token for emails, slugs, codes. */
export const uid = (prefix = "") => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Console noise that is expected (failed requests are asserted on separately). */
const IGNORED = [
  /Failed to load resource/i,
  /status of 4\d\d/i,
  /Download the React DevTools/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
  /net::ERR_FAILED/i,
  // WebKit's wording for an in-flight fetch (a Next.js link prefetch) cancelled by a page navigation
  /_rsc=[\w-]+ due to access control checks/,
];

// ------------------------------------------------------------ admin API

export interface TestProduct {
  id: string;
  slug: string;
  name: string;
  variants: { id: string; code: string; price: number; stock: number; label: string }[];
}

export class AdminApi {
  constructor(readonly ctx: APIRequestContext) {}

  async call<T = Record<string, unknown>>(method: string, url: string, data?: unknown): Promise<T> {
    const res = await this.ctx.fetch(`/api/v1/admin${url}`, { method, data });
    const body = await res.json().catch(() => ({}));
    if (!res.ok()) throw new Error(`${method} ${url} → ${res.status()} ${JSON.stringify(body)}`);
    return body as T;
  }

  /** Creates an active product with the given variants (prices in DA, stock levels). */
  async product(opts: {
    name?: string;
    category?: string;
    variants?: { price: number; stock: number; label?: string; compareAt?: number | null }[];
    status?: "active" | "draft" | "archived";
  } = {}): Promise<TestProduct> {
    const tag = uid();
    const slug = `e2e-${tag}`;
    const name = opts.name ?? `E2E Gadget ${tag.toUpperCase()}`;
    const variants = (opts.variants ?? [{ price: 2500, stock: 20 }]).map((v, i) => ({
      code: `v${i + 1}`,
      sku: `E2E-${tag.toUpperCase()}-${i + 1}`,
      price: v.price,
      compareAtPrice: v.compareAt ?? null,
      stock: v.stock,
      position: i,
      labels: { fr: v.label ?? `Option ${i + 1}`, ar: `خيار ${i + 1}` },
    }));
    const { product } = await this.call<{ product: { id: string; slug: string; name: string; adminVariants: { id: string; code: string; price: number; stock: number; labels: { fr: string } }[] } }>(
      "POST",
      "/products",
      {
        slug,
        name,
        categorySlug: opts.category ?? "vision",
        status: opts.status ?? "active",
        translations: {
          fr: { short: "Produit de test E2E.", description: "Produit créé par la suite E2E pour un scénario isolé." },
          ar: { short: "منتج اختبار.", description: "منتج أنشأته مجموعة الاختبارات." },
        },
        variants,
      },
    );
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      variants: product.adminVariants.map((v) => ({ id: v.id, code: v.code, price: v.price, stock: v.stock, label: v.labels.fr })),
    };
  }

  async stock(variantId: string): Promise<number> {
    const { items } = await this.call<{ items: { stockAfter: number }[] }>("GET", `/variants/${variantId}/stock`);
    if (items.length) return items[0].stockAfter;
    throw new Error("no stock movements for variant");
  }

  /** Current stock straight from the product (works even before any movement). */
  async variantStock(productId: string, variantId: string): Promise<number> {
    const { product } = await this.call<{ product: { adminVariants: { id: string; stock: number }[] } }>("GET", `/products/${productId}`);
    return product.adminVariants.find((v) => v.id === variantId)!.stock;
  }

  setStock(variantId: string, set: number) {
    return this.call("POST", `/variants/${variantId}/stock`, { set, reason: "adjustment", note: "e2e" });
  }

  movements(variantId: string) {
    return this.call<{ items: { delta: number; stockAfter: number; reason: string; orderId: string | null }[] }>("GET", `/variants/${variantId}/stock`).then((r) => r.items);
  }

  promo(input: Record<string, unknown>) {
    return this.call<{ promotion: { id: string; code: string } }>("POST", "/promotions", input).then((r) => r.promotion);
  }

  async promoByCode(code: string) {
    const { items } = await this.call<{ items: { code: string; usedCount: number; id: string }[] }>("GET", "/promotions");
    return items.find((p) => p.code === code.toUpperCase());
  }

  order(number: string) {
    return this.call<{ order: Record<string, unknown> & { status: string; subtotal: number; discount: number; total: number; items: { variantId: string; qty: number; unitPrice: number }[]; userId: string | null; promoCode: string | null } }>(
      "GET",
      `/orders/${number}`,
    ).then((r) => r.order);
  }

  ordersFor(q: string) {
    return this.call<{ items: { number: string; total: number; status: string }[]; total: number }>("GET", `/orders?q=${encodeURIComponent(q)}&pageSize=50`);
  }

  status(number: string, status: string, extra: Record<string, unknown> = {}) {
    return this.call("POST", `/orders/${number}/status`, { status, ...extra });
  }

  patchProduct(id: string, patch: Record<string, unknown>) {
    return this.call("PATCH", `/products/${id}`, patch);
  }
}

/**
 * A signed-in admin API client. Signs in fresh rather than reusing the stored
 * cookie: that one expires with the access token (1 h), so a long run — or a
 * laptop that sleeps mid-run — would otherwise fail every setup call with 401.
 */
export async function adminContext(): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE } });
  const res = await ctx.post("/api/v1/auth/login", { data: { email: "admin@hanutek.test", password: "Admin-pass-2026!" } });
  if (!res.ok()) throw new Error(`admin sign-in failed: ${res.status()} ${await res.text()}`);
  return ctx;
}

// ------------------------------------------------------------ customers

export interface Customer {
  email: string;
  password: string;
  name: string;
}

/** Registers a fresh customer through the real API, signing `ctx` in (cookies land in the browser context). */
export async function registerVia(ctx: APIRequestContext, over: Partial<Customer> = {}): Promise<Customer> {
  const c: Customer = { email: `${uid("shopper.")}@example.dz`, password: PASSWORD, name: "Lina Ziani", ...over };
  // relative: follows the context's baseURL (the HTTPS front on WebKit)
  const res = await ctx.post("/api/v1/auth/register", {
    data: { name: c.name, email: c.email, password: c.password, locale: "fr", acceptTerms: true },
    headers: { origin: BASE },
  });
  expect(res.status(), await res.text()).toBe(201);
  return c;
}

export async function loginVia(ctx: APIRequestContext, c: Customer) {
  const res = await ctx.post("/api/v1/auth/login", { data: { email: c.email, password: c.password }, headers: { origin: BASE } });
  expect(res.status(), await res.text()).toBe(200);
}

/** Same-origin JSON call from inside the page (cookies + CSRF exactly like the app). */
export async function pageApi<T = Record<string, unknown>>(page: Page, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  return page.evaluate(
    async ({ method, url, body, headers }) => {
      const r = await fetch(`/api/v1${url}`, {
        method,
        headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: "same-origin",
      });
      let json: unknown = null;
      try {
        json = await r.json();
      } catch {
        /* empty */
      }
      return { status: r.status, json: json as T };
    },
    { method, url, body, headers },
  );
}

// ------------------------------------------------------------ mail outbox

interface Mail {
  to: string;
  subject: string;
  text: string;
  sentAt: string;
}

export function outbox(to: string): Mail[] {
  if (!existsSync(OUTBOX)) return [];
  return readdirSync(OUTBOX)
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(OUTBOX, f), "utf8")) as Mail)
    .filter((m) => m.to === to);
}

/** Waits for the newest mail to `to` whose subject matches, returns the link in it. */
export async function mailLink(to: string, subject: RegExp, after = 0): Promise<string> {
  let link = "";
  await expect
    .poll(
      () => {
        const mail = outbox(to).filter((m) => subject.test(m.subject) && Date.parse(m.sentAt) >= after).at(-1);
        link = mail?.text.match(/https?:\/\/\S+/)?.[0] ?? "";
        return link;
      },
      { message: `mail "${subject}" to ${to}`, timeout: 10_000 },
    )
    .not.toBe("");
  return link.replace(/^https?:\/\/[^/]+/, ""); // relative, so it follows baseURL
}

// ------------------------------------------------------------ tokens

/** An access token that is correctly signed but already expired (for session-restoration tests). */
export async function expiredAccessToken(userId: string, sid: string, tv = 0) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: "customer", tv, sid })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer("hanutek")
    .setAudience("hanutek-api")
    .setIssuedAt(now - 7200)
    .setExpirationTime(now - 60)
    .sign(new TextEncoder().encode(E2E_JWT_SECRET));
}

/** Queues the identity the mock Google provider signs in next. */
export async function nextGoogleIdentity(who: { sub: string; email: string; name?: string; email_verified?: boolean } | { error: string }) {
  const ctx = await pwRequest.newContext();
  await ctx.post(`${OIDC}/__next`, { data: who });
  await ctx.dispose();
}

// ------------------------------------------------------------ UI helpers

export async function setLocale(page: Page, locale: "fr" | "ar") {
  await page.addInitScript((l) => {
    try {
      localStorage.setItem("hanutek-locale", l);
    } catch {
      /* about:blank */
    }
  }, locale);
}

/** Navigates and waits for the store's session bootstrap (user + cart + favorites) to come back. */
export async function gotoStore(page: Page, url: string) {
  const session = page.waitForResponse((r) => r.url().includes("/api/v1/auth/session") && r.request().method() === "POST");
  await page.goto(url);
  await session;
  await expect(page.locator("main")).toBeVisible();
}

export const toastText = (page: Page, text: string | RegExp) => page.locator("[role=status]").filter({ hasText: text }).first();

/** Fills the checkout form that lives under the cart lines. */
export async function fillCheckout(
  scope: Page | import("@playwright/test").Locator,
  v: { name?: string; phone?: string; email?: string; address?: string; commune?: string; wilaya?: string; postalCode?: string } = {},
) {
  const page = "page" in scope ? scope.page() : scope;
  const root = "page" in scope ? scope : page.locator("#checkout");
  const fill = async (name: string, value?: string) => {
    if (value === undefined) return;
    const input = root.locator(`input[name="${name}"]`);
    await input.fill(value);
  };
  await fill("name", v.name ?? "Karim Benali");
  await fill("phone", v.phone ?? "0550 12 34 56");
  await fill("email", v.email);
  await fill("address", v.address ?? "12 Rue Didouche Mourad");
  await fill("commune", v.commune ?? "Alger Centre");
  if (v.wilaya !== "") {
    await root.getByRole("button", { name: "Wilaya" }).click();
    await page.getByRole("option", { name: new RegExp(`^${v.wilaya ?? "16"} — `) }).click();
  }
  await fill("postalCode", v.postalCode);
}

/** Viewport has no horizontal scroll (the classic mobile overflow bug). */
export async function expectNoHorizontalOverflow(page: Page, label = "", soft = false) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders: string[] = [];
    if (doc.scrollWidth > doc.clientWidth + 1) {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && (b.right > doc.clientWidth + 1 || b.left < -1) && getComputedStyle(el).position !== "fixed") {
          // only report the outermost offender of each branch
          if (!offenders.some((o) => el.closest(o))) offenders.push(el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 3).join(".") : ""));
        }
        if (offenders.length > 5) break;
      }
    }
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, offenders };
  });
  (soft ? expect.soft : expect)(r.scrollWidth, `horizontal overflow ${label}: ${r.offenders.join(", ")}`).toBeLessThanOrEqual(r.clientWidth + 1);
}

// ------------------------------------------------------------ test fixture

type Fixtures = { errors: string[]; admin: AdminApi; failedRequests: string[] };

/**
 * Every test fails on uncaught page errors or console errors (React warnings,
 * hydration mismatches) and on unexpected 5xx responses.
 */
export const test = base.extend<Fixtures>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => !/_rsc=[\w-]+ due to access control checks/.test(e.message) && errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) errors.push(`console: ${m.text().slice(0, 400)}`);
      });
      await use(errors);
      expect(errors, "page errors / console errors").toEqual([]);
    },
    { auto: true },
  ],
  failedRequests: [
    async ({ page }, use) => {
      const failed: string[] = [];
      page.on("response", (r) => {
        if (r.status() >= 500 && !r.request().headers()["x-e2e-allow-5xx"]) failed.push(`${r.status()} ${r.request().method()} ${r.url()}`);
      });
      await use(failed);
      expect(failed, "server errors (5xx)").toEqual([]);
    },
    { auto: true },
  ],
  admin: async ({}, provide) => {
    const ctx = await adminContext();
    await provide(new AdminApi(ctx));
    await ctx.dispose();
  },
});
export { expect };

/** A second, independent shopper (own cookies) in the same browser. */
export async function newShopper(browser: Browser, page: Page): Promise<{ context: BrowserContext; page: Page }> {
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  const context = await browser.newContext({ baseURL: BASE, viewport: vp, locale: "fr-FR", timezoneId: "Africa/Algiers" });
  return { context, page: await context.newPage() };
}
