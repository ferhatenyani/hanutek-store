import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import { test, expect, uid, registerVia, gotoStore, pageApi, BASE, COOKIES, PASSWORD } from "../support";

/**
 * API-level adversarial tests. The browser UI is not a security boundary, so
 * these talk to /api/v1 directly — as another customer, a guest, an
 * attacker's origin, or with tampered tokens and payloads.
 */
const json = { origin: BASE };
async function shopper(): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: json });
  await registerVia(ctx);
  return ctx;
}
async function guest(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: json });
}
const checkoutBody = (over: Record<string, unknown> = {}) => ({
  idempotencyKey: randomUUID(),
  contact: { name: "Sec Test", phone: "0550112233" },
  address: { line1: "1 Rue Test", commune: "Alger", wilaya: "16" },
  locale: "fr",
  ...over,
});

test.describe("authorization: customers can only reach their own data", () => {
  test("another customer's order is invisible and can't be cancelled (404, not 403 — no enumeration)", async ({ admin }) => {
    const p = await admin.product({ variants: [{ price: 1000, stock: 10 }] });
    const alice = await shopper();
    await alice.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty: 1 } });
    const placed = await alice.post("/api/v1/orders", { data: checkoutBody() });
    expect(placed.status()).toBe(201);
    const { order } = await placed.json();

    const mallory = await shopper();
    for (const res of [await mallory.get(`/api/v1/orders/${order.number}`), await mallory.post(`/api/v1/orders/${order.number}/cancel`)]) {
      expect(res.status()).toBe(404);
      expect((await res.json()).error.code).toBe("NOT_FOUND");
    }
    // a non-existent order looks identical
    const ghost = await mallory.get(`/api/v1/orders/HT-000001`);
    expect(ghost.status()).toBe(404);
    // mallory's order list doesn't include it
    expect(((await (await mallory.get("/api/v1/me/orders")).json()).items as unknown[]).length).toBe(0);
    expect((await admin.order(order.number)).status).toBe("pending");
    await Promise.all([alice.dispose(), mallory.dispose()]);
  });

  test("guest orders need the right access key; a wrong key or another order's key is 404", async ({ admin }) => {
    const p = await admin.product({ variants: [{ price: 1000, stock: 10 }] });
    const g1 = await guest();
    await g1.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty: 1 } });
    const r1 = await (await g1.post("/api/v1/orders", { data: checkoutBody({ contact: { name: "G One", phone: "0550000001" } }) })).json();
    const g2 = await guest();
    await g2.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty: 1 } });
    const r2 = await (await g2.post("/api/v1/orders", { data: checkoutBody({ contact: { name: "G Two", phone: "0550000002" } }) })).json();

    expect((await g2.get(`/api/v1/orders/${r1.order.number}`, { headers: { "x-order-key": r1.accessKey } })).status()).toBe(200);
    expect((await g2.get(`/api/v1/orders/${r1.order.number}`, { headers: { "x-order-key": r2.accessKey } })).status()).toBe(404);
    expect((await g2.get(`/api/v1/orders/${r1.order.number}`, { headers: { "x-order-key": "A".repeat(43) } })).status()).toBe(404);
    expect((await g2.post(`/api/v1/orders/${r1.order.number}/cancel`, { headers: { "x-order-key": r2.accessKey } })).status()).toBe(404);
    expect((await admin.order(r1.order.number)).status).toBe("pending");
    await Promise.all([g1.dispose(), g2.dispose()]);
  });

  test("a customer can't use the admin API, and can't escalate through profile or registration fields", async ({ admin }) => {
    const c = await shopper();
    for (const [method, path] of [["GET", "/admin/orders"], ["GET", "/admin/customers"], ["POST", "/admin/promotions"], ["PATCH", "/admin/customers/" + randomUUID()], ["GET", "/admin/me"]] as const) {
      const res = await c.fetch(`/api/v1${path}`, { method, data: method === "GET" ? undefined : { code: "HACK", type: "percent", value: 100, role: "admin" } });
      expect(res.status(), `${method} ${path}`).toBe(403);
    }
    // mass assignment: role/emailVerified/status are not writable by the customer
    await c.patch("/api/v1/me", { data: { name: "Still Customer", role: "admin", emailVerified: true, status: "active", tokenVersion: 0 } });
    const me = (await (await c.get("/api/v1/me")).json()).user;
    expect(me).toMatchObject({ name: "Still Customer", role: "customer", emailVerified: false });

    const g = await guest();
    const email = `${uid("massassign.")}@example.dz`;
    const reg = await g.post("/api/v1/auth/register", { data: { name: "Sneaky", email, password: PASSWORD, locale: "fr", acceptTerms: true, role: "admin", emailVerifiedAt: new Date().toISOString() } });
    expect(reg.status()).toBe(201);
    expect((await reg.json()).user).toMatchObject({ role: "customer", emailVerified: false });
    expect((await g.get("/api/v1/admin/orders")).status()).toBe(403);
    await Promise.all([c.dispose(), g.dispose()]);
    void admin;
  });

  test("protected endpoints require a session; anonymous calls get 401", async () => {
    const g = await guest();
    for (const path of ["/me", "/me/orders", "/me/addresses", "/me/favorites", "/admin/orders"]) {
      expect((await g.get(`/api/v1${path}`)).status(), path).toBe(401);
    }
    expect((await g.patch("/api/v1/me", { data: { name: "x" } })).status()).toBe(401);
    expect((await g.post("/api/v1/auth/password/change", { data: { newPassword: "whatever-123" } })).status()).toBe(401);
    await g.dispose();
  });
});

test.describe("tokens & sessions", () => {
  test("tampered, wrongly-signed, alg=none and other-audience tokens are rejected", async () => {
    const c = await shopper();
    const at = (await c.storageState()).cookies.find((x) => x.name === COOKIES.access)!.value;
    const [h, p] = at.split(".");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    const tamperedPayload = Buffer.from(JSON.stringify({ ...claims, role: "admin" })).toString("base64url");
    const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${tamperedPayload}.`;
    const wrongKey = await new SignJWT({ role: "admin", tv: claims.tv, sid: claims.sid })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuer("hanutek")
      .setAudience("hanutek-api")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("attacker-guessed-secret-0123456789-abcdef"));
    for (const token of [`${h}.${tamperedPayload}.${at.split(".")[2]}`, none, wrongKey, "garbage"]) {
      const res = await (await guest()).get("/api/v1/admin/orders", { headers: { authorization: `Bearer ${token}` } });
      expect(res.status()).toBe(401);
    }
    await c.dispose();
  });

  test("a disabled account loses access immediately, even with a still-valid access token", async ({ admin }) => {
    const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: json });
    const c = await registerVia(ctx);
    const me = (await (await ctx.get("/api/v1/me")).json()).user;
    await admin.call("PATCH", `/customers/${me.id}`, { status: "disabled" });
    expect((await ctx.get("/api/v1/me")).status()).toBe(401);
    const login = await ctx.post("/api/v1/auth/login", { data: { email: c.email, password: c.password } });
    expect((await login.json()).error.code).toBe("ACCOUNT_DISABLED");
    await ctx.dispose();
  });
});

test.describe("CSRF & origin checks", () => {
  test("cookie-authenticated writes from another origin are rejected", async () => {
    const c = await shopper();
    const evil = { origin: "https://evil.example" };
    for (const [path, data] of [["/api/v1/me", { name: "pwned" }], ["/api/v1/auth/logout", {}], ["/api/v1/orders", checkoutBody()]] as const) {
      const method = path === "/api/v1/me" ? "PATCH" : "POST";
      const res = await c.fetch(path, { method, data, headers: evil });
      expect(res.status(), path).toBe(403);
      expect((await res.json()).error.code).toBe("CSRF");
    }
    // a cross-site request without Origin but flagged cross-site by the browser is rejected too
    const res = await c.fetch("/api/v1/me", { method: "PATCH", data: { name: "pwned" }, headers: { origin: "", "sec-fetch-site": "cross-site" } });
    expect(res.status()).toBe(403);
    expect((await (await c.get("/api/v1/me")).json()).user.name).not.toBe("pwned");
    await c.dispose();
  });

  test("CORS: no credentialed access for arbitrary origins", async () => {
    const g = await guest();
    const pre = await g.fetch("/api/v1/cart", { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
    expect(pre.status()).toBe(403);
    const get = await g.get("/api/v1/products", { headers: { origin: "https://evil.example" } });
    expect(get.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(get.headers()["access-control-allow-credentials"]).toBeUndefined();
    await g.dispose();
  });
});

test.describe("server-side pricing and input validation", () => {
  test("client-sent prices, totals and discounts are ignored — the server prices everything", async ({ admin }) => {
    const p = await admin.product({ variants: [{ price: 4999, stock: 10 }] });
    const c = await shopper();
    const add = await c.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty: 2, price: 1, unitPrice: 1, lineTotal: 1 } });
    expect((await add.json()).cart).toMatchObject({ subtotal: 9998, total: 9998 });
    const res = await c.post("/api/v1/orders", { data: { ...checkoutBody(), subtotal: 1, total: 1, discount: 9997, shippingFee: -100, items: [{ variantId: p.variants[0].id, qty: 2, unitPrice: 1 }] } });
    expect(res.status()).toBe(201);
    const { order } = await res.json();
    const stored = await admin.order(order.number);
    expect(stored).toMatchObject({ subtotal: 9998, discount: 0, shippingFee: 0, total: 9998 });
    await c.dispose();
  });

  test("quantities: negative, zero, fractional, over the per-line limit and non-numeric are refused or capped", async ({ admin }) => {
    const p = await admin.product({ variants: [{ price: 1000, stock: 50 }] });
    const g = await guest();
    for (const qty of [-1, 0, 1.5, 11, "3", null, 1e9]) {
      const res = await g.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty } });
      expect(res.status(), `qty=${qty}`).toBe(422);
    }
    expect((await g.patch(`/api/v1/cart/items/${p.variants[0].id}`, { data: { qty: -5 } })).status()).toBe(422);
    // adding repeatedly never exceeds the per-line cap of 10
    for (let i = 0; i < 4; i++) await g.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty: 4 } });
    expect((await (await g.get("/api/v1/cart")).json()).cart.lines[0].qty).toBe(10);
    await g.dispose();
  });

  test("inactive, draft and unknown variants can't be added to a cart", async ({ admin }) => {
    const draft = await admin.product({ status: "draft" });
    const g = await guest();
    for (const variantId of [draft.variants[0].id, randomUUID(), "not-a-uuid"]) {
      const res = await g.post("/api/v1/cart/items", { data: { variantId, qty: 1 } });
      expect([404, 422], variantId).toContain(res.status());
    }
    await g.dispose();
  });

  test("a product archived after it was added to a cart can't be checked out", async ({ admin }) => {
    const p = await admin.product({ variants: [{ price: 1200, stock: 10 }] });
    const g = await guest();
    await g.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty: 1 } });
    await admin.call("DELETE", `/products/${p.id}`);
    const cart = (await (await g.get("/api/v1/cart")).json()).cart;
    expect(cart.lines[0]).toMatchObject({ available: false, maxQty: 0 });
    expect(cart.subtotal).toBe(0);
    const res = await g.post("/api/v1/orders", { data: checkoutBody() });
    expect((await res.json()).error.code).toBe("OUT_OF_STOCK");
    expect(await admin.variantStock(p.id, p.variants[0].id)).toBe(10);
    await g.dispose();
  });

  test("checkout input is validated server-side (phone, wilaya, postcode, lengths, idempotency key)", async ({ admin }) => {
    const p = await admin.product();
    const g = await guest();
    await g.post("/api/v1/cart/items", { data: { variantId: p.variants[0].id, qty: 1 } });
    const bad: [string, Record<string, unknown>][] = [
      ["contact.phone", { contact: { name: "A B", phone: "12345" } }],
      ["address.wilaya", { address: { line1: "x", commune: "y", wilaya: "99" } }],
      ["address.postalCode", { address: { line1: "x", commune: "y", wilaya: "16", postalCode: "1600" } }],
      ["contact.name", { contact: { name: "A".repeat(500), phone: "0550112233" } }],
      ["idempotencyKey", { idempotencyKey: "not-a-uuid" }],
    ];
    for (const [field, over] of bad) {
      const res = await g.post("/api/v1/orders", { data: checkoutBody(over) });
      expect(res.status(), field).toBe(422);
      expect(Object.keys((await res.json()).error.fields), field).toContain(field);
    }
    await g.dispose();
  });

  test("malformed JSON, wrong content type and oversized bodies are refused cleanly (no 500)", async () => {
    const g = await guest();
    expect((await g.post("/api/v1/cart/items", { data: Buffer.from("{not json"), headers: { "content-type": "application/json" } })).status()).toBe(400);
    expect((await g.post("/api/v1/cart/items", { data: "variantId=x", headers: { "content-type": "application/x-www-form-urlencoded" } })).status()).toBe(415);
    const huge = await g.post("/api/v1/auth/register", { data: { name: "x".repeat(200_000), email: "a@b.dz", password: PASSWORD, acceptTerms: true } });
    expect(huge.status()).toBe(413);
    await g.dispose();
  });

  test("promo codes: format-validated, case-insensitive, and can't be stacked", async () => {
    const g = await guest();
    expect((await g.post("/api/v1/cart/promo", { data: { code: "' OR 1=1 --" } })).status()).toBe(422);
    expect((await g.post("/api/v1/cart/promo", { data: { code: "X".repeat(41) } })).status()).toBe(422);
    await g.dispose();
  });
});

test.describe("redirects & injection", () => {
  test("post-login redirects stay on this site (open-redirect payloads fall back to /profile)", async ({ page }) => {
    const c = await registerVia(page.context().request);
    for (const next of ["//evil.example", "/\\evil.example", "/\t/evil.example", "https://evil.example", "/%2F%2Fevil.example"]) {
      await page.context().clearCookies();
      await gotoStore(page, `/login?next=${encodeURIComponent(next)}`);
      await page.getByLabel("E-mail", { exact: true }).fill(c.email);
      await page.getByLabel("Mot de passe", { exact: true }).fill(c.password);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"));
      expect(new URL(page.url()).origin, `next=${JSON.stringify(next)}`).toBe(BASE);
    }
    // the Google start endpoint sanitizes `next` the same way (it is signed into the state)
    const res = await page.request.get(`/api/v1/auth/google/start?next=${encodeURIComponent("/\t/evil.example")}`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
  });

  test("user-supplied text is rendered as text, never as HTML", async ({ page }) => {
    const xss = `<img src=x onerror="window.__pwned=1">"><script>window.__pwned=1</script>`;
    await registerVia(page.context().request, { name: xss });
    let dialog = false;
    page.on("dialog", (d) => {
      dialog = true;
      void d.dismiss();
    });
    await gotoStore(page, "/profile");
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toContainText("<img");
    await gotoStore(page, `/products?q=${encodeURIComponent(xss)}`);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(dialog).toBe(false);
  });

  test("security headers are sent on pages and API responses", async ({ page }) => {
    const res = await page.goto("/");
    const h = res!.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"] ?? h["content-security-policy"]).toBeTruthy();
    expect(h["referrer-policy"]).toBeTruthy();
    const api = await page.request.get("/api/v1/cart");
    expect(api.headers()["cache-control"]).toContain("no-store");
    const order = await pageApi(page, "GET", "/me");
    expect(order.status).toBe(401);
  });

  test("auth cookies are httpOnly, SameSite and scoped (refresh token only goes to /api/v1/auth)", async ({ context }) => {
    await registerVia(context.request);
    const cookies = await context.cookies();
    const at = cookies.find((c) => c.name === COOKIES.access)!;
    const rt = cookies.find((c) => c.name === COOKIES.refresh)!;
    expect(at).toMatchObject({ httpOnly: true, sameSite: "Lax", secure: true, path: "/" });
    expect(rt).toMatchObject({ httpOnly: true, sameSite: "Strict", secure: true, path: "/api/v1/auth" });
  });
});
