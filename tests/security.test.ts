import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { Client, freshDb } from "./helpers";
import * as register from "@/app/api/v1/auth/register/route";
import * as login from "@/app/api/v1/auth/login/route";
import * as me from "@/app/api/v1/me/route";
import * as cartItems from "@/app/api/v1/cart/items/route";
import * as adminOrders from "@/app/api/v1/admin/orders/route";
import { safeNext } from "@/server/auth/google";
import { clientIp } from "@/server/lib/http";
import { resetEnvCache } from "@/server/env";
import { computeDiscount } from "@/server/services/promotions";
import { buildTimeline, normalizePhone } from "@/server/services/orders";
import { sniffImage } from "@/server/services/media";

let close: () => Promise<void>;
beforeAll(async () => ({ close } = await freshDb()));
afterAll(() => close());

const creds = { name: "Sec Tester", email: "sec@example.dz", password: "Sec-pass-123", acceptTerms: true };

describe("CSRF", () => {
  it("rejects cookie-authenticated state changes from another origin", async () => {
    const c = new Client();
    await c.call(register.POST, "POST", "/api/v1/auth/register", { body: creds });
    const evil = await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: crypto.randomUUID() }, headers: { origin: "https://evil.example" } });
    expect(evil.status).toBe(403);
    expect(evil.data.error.code).toBe("CSRF");
  });

  it("rejects cookie requests with neither Origin nor same-origin Sec-Fetch-Site", async () => {
    const c = new Client(null);
    c.jar.set("ht_cart", { value: "x", path: "/" });
    const r = await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: crypto.randomUUID() } });
    expect(r.data.error.code).toBe("CSRF");
    const ok = await c.call(cartItems.POST, "POST", "/api/v1/cart/items", { body: { variantId: crypto.randomUUID() }, headers: { "sec-fetch-site": "same-origin" } });
    expect(ok.status).toBe(404); // passed CSRF, unknown variant
  });

  it("does not apply to cookieless (bearer / server) requests", async () => {
    const r = await new Client(null).call(login.POST, "POST", "/api/v1/auth/login", { body: { email: creds.email, password: creds.password } });
    expect(r.status).toBe(200);
  });
});

describe("request hygiene", () => {
  it("requires JSON content type", async () => {
    const r = await new Client().call(login.POST, "POST", "/api/v1/auth/login", { raw: "email=a", headers: { "content-type": "application/x-www-form-urlencoded" } });
    expect(r.status).toBe(415);
  });

  it("rejects malformed JSON without leaking internals", async () => {
    const r = await new Client().call(login.POST, "POST", "/api/v1/auth/login", { raw: "{bad json", headers: { "content-type": "application/json" } });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.data)).not.toMatch(/stack|SyntaxError|at /);
  });

  it("caps body size", async () => {
    const r = await new Client().call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "a@b.dz", password: "x".repeat(70_000) } });
    expect(r.status).toBe(413);
  });

  it("strips unknown fields (no mass assignment of role)", async () => {
    const c = new Client();
    const r = await c.call(register.POST, "POST", "/api/v1/auth/register", { body: { ...creds, email: "mass@example.dz", role: "admin" } });
    expect(r.data.user.role).toBe("customer");
    const patch = await c.call(me.PATCH, "PATCH", "/api/v1/me", { body: { role: "admin", name: "Still Customer" } });
    expect(patch.data.user).toMatchObject({ role: "customer", name: "Still Customer" });
    expect((await c.call(adminOrders.GET, "GET", "/api/v1/admin/orders")).status).toBe(403);
  });

  it("tags every response with a request id", async () => {
    const r = await new Client().call(me.GET, "GET", "/api/v1/me");
    expect(r.res.headers.get("x-request-id")).toBeTruthy();
    expect(r.res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("token forgery", () => {
  it("rejects alg=none and wrongly-signed tokens", async () => {
    const payload = Buffer.from(JSON.stringify({ sub: crypto.randomUUID(), role: "admin", tv: 0, sid: "x", iss: "hanutek", aud: "hanutek-api", exp: 9999999999 })).toString("base64url");
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${payload}.`;
    expect((await new Client().call(me.GET, "GET", "/api/v1/me", { headers: { authorization: `Bearer ${none}` } })).status).toBe(401);
    const wrongKey = await new SignJWT({ role: "admin", tv: 0, sid: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(crypto.randomUUID())
      .setIssuer("hanutek")
      .setAudience("hanutek-api")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("attacker-secret-attacker-secret-1234"));
    expect((await new Client().call(adminOrders.GET, "GET", "/api/v1/admin/orders", { headers: { authorization: `Bearer ${wrongKey}` } })).status).toBe(401);
  });
});

describe("rate limiting", () => {
  afterEach(() => {
    process.env.RATE_LIMIT_DISABLED = "1";
  });
  it("throttles repeated login attempts per account with Retry-After", async () => {
    process.env.RATE_LIMIT_DISABLED = "0";
    let last = 0;
    let retry: string | null = null;
    for (let i = 0; i < 10; i++) {
      const r = await new Client().call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "throttle@example.dz", password: "whatever-1" } });
      last = r.status;
      retry = r.res.headers.get("retry-after");
    }
    expect(last).toBe(429);
    expect(Number(retry)).toBeGreaterThan(0);
  });
});

describe("helpers", () => {
  it("only allows same-site relative redirects", () => {
    expect(safeNext("/profile?tab=orders")).toBe("/profile?tab=orders");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null]) expect(safeNext(bad)).toBe("/profile");
  });

  it("ignores X-Forwarded-For unless proxies are trusted", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "6.6.6.6, 10.0.0.1" } });
    expect(clientIp(req)).toBe("local");
    process.env.TRUST_PROXY_HOPS = "1";
    resetEnvCache();
    expect(clientIp(req)).toBe("10.0.0.1"); // client-supplied left entries are not trusted
    process.env.TRUST_PROXY_HOPS = "2";
    resetEnvCache();
    expect(clientIp(req)).toBe("6.6.6.6");
    delete process.env.TRUST_PROXY_HOPS;
    resetEnvCache();
  });

  it("computes discounts safely", () => {
    expect(computeDiscount({ type: "percent", value: 10, maxDiscount: null }, 14900)).toBe(1490);
    expect(computeDiscount({ type: "percent", value: 50, maxDiscount: 1000 }, 14900)).toBe(1000);
    expect(computeDiscount({ type: "fixed", value: 99999, maxDiscount: null }, 500)).toBe(500);
    expect(computeDiscount({ type: "fixed", value: 100, maxDiscount: null }, 0)).toBe(0);
  });

  it("normalizes Algerian phone numbers", () => {
    expect(normalizePhone("+213 550 12 34 56")).toBe("0550123456");
    expect(normalizePhone("00213-661.22.33.44")).toBe("0661223344");
  });

  it("back-fills skipped tracking steps", () => {
    const t0 = new Date("2026-01-01T10:00:00Z");
    const t1 = new Date("2026-01-03T10:00:00Z");
    const tl = buildTimeline(t0, [{ status: "pending", createdAt: t0 }, { status: "shipped", createdAt: t1 }]);
    expect(tl.map((s) => s.at)).toEqual([t0.toISOString(), t1.toISOString(), t1.toISOString(), null, null]);
  });

  it("sniffs images by magic bytes", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpeg");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});
