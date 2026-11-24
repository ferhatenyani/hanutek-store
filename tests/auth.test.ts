import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { Client, freshDb } from "./helpers";
import * as register from "@/app/api/v1/auth/register/route";
import * as login from "@/app/api/v1/auth/login/route";
import * as logout from "@/app/api/v1/auth/logout/route";
import * as refresh from "@/app/api/v1/auth/refresh/route";
import * as session from "@/app/api/v1/auth/session/route";
import * as me from "@/app/api/v1/me/route";
import * as verifyEmail from "@/app/api/v1/auth/verify-email/route";
import * as forgot from "@/app/api/v1/auth/password/forgot/route";
import * as reset from "@/app/api/v1/auth/password/reset/route";
import * as change from "@/app/api/v1/auth/password/change/route";
import * as token from "@/app/api/v1/auth/token/route";
import * as tokenRefresh from "@/app/api/v1/auth/token/refresh/route";
import { outbox } from "@/server/services/mail";
import { refreshSessions, users } from "@/server/db/schema";
import { signAccessToken } from "@/server/auth/tokens";
import { loginWithGoogle } from "@/server/services/accounts";
import type { Db } from "@/server/db/client";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await freshDb()));
afterAll(() => close());

const AT = "ht_at";
const RT = "ht_rt";
const newUser = (n: number) => ({ name: "Amina Bensalem", email: `amina${n}@example.dz`, password: "S3cure-pass!", acceptTerms: true });
const linkFrom = (text: string) => new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

describe("registration", () => {
  it("creates an account, sets httpOnly session cookies and never returns secrets", async () => {
    const c = new Client();
    const r = await c.call(register.POST, "POST", "/api/v1/auth/register", { body: newUser(1) });
    expect(r.status).toBe(201);
    expect(r.data.user).toMatchObject({ email: "amina1@example.dz", name: "Amina Bensalem", emailVerified: false, role: "customer" });
    expect(JSON.stringify(r.data)).not.toMatch(/passwordHash|tokenHash|argon2|refreshToken|accessToken/i);
    const setCookies = r.res.headers.getSetCookie();
    expect(setCookies.find((s) => s.startsWith(`${AT}=`))).toMatch(/HttpOnly/);
    expect(setCookies.find((s) => s.startsWith(`${RT}=`))).toMatch(/Path=\/api\/v1\/auth.*SameSite=Strict.*HttpOnly/);
    const [row] = await db.select().from(users).where(eq(users.email, "amina1@example.dz"));
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("normalizes email case and rejects duplicates", async () => {
    const r = await new Client().call(register.POST, "POST", "/api/v1/auth/register", { body: { ...newUser(1), email: "  AMINA1@Example.DZ " } });
    expect(r.status).toBe(409);
    expect(r.data.error.code).toBe("EMAIL_TAKEN");
  });

  it("validates input with field-level errors", async () => {
    const r = await new Client().call(register.POST, "POST", "/api/v1/auth/register", {
      body: { name: "A", email: "not-an-email", password: "short", acceptTerms: false },
    });
    expect(r.status).toBe(422);
    expect(Object.keys(r.data.error.fields)).toEqual(expect.arrayContaining(["name", "email", "password", "acceptTerms"]));
  });

  it("sends a verification email whose single-use link verifies the address", async () => {
    const mail = outbox.find((m) => m.to === "amina1@example.dz");
    expect(mail?.subject).toMatch(/Confirmez/);
    const t = linkFrom(mail!.text);
    const c = new Client();
    expect((await c.call(verifyEmail.POST, "POST", "/api/v1/auth/verify-email", { body: { token: t } })).status).toBe(200);
    expect((await c.call(verifyEmail.POST, "POST", "/api/v1/auth/verify-email", { body: { token: t } })).data.error.code).toBe("TOKEN_INVALID");
    const [row] = await db.select().from(users).where(eq(users.email, "amina1@example.dz"));
    expect(row.emailVerifiedAt).not.toBeNull();
  });
});

describe("login & sessions", () => {
  it("rejects a wrong password with a generic error", async () => {
    const r = await new Client().call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "nope-nope" } });
    expect(r.status).toBe(401);
    expect(r.data.error.code).toBe("INVALID_CREDENTIALS");
    const unknown = await new Client().call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "ghost@example.dz", password: "nope-nope" } });
    expect(unknown.data.error).toEqual(r.data.error); // no account enumeration
  });

  it("logs in and resolves the user through the access cookie", async () => {
    const c = new Client();
    expect((await c.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "S3cure-pass!" } })).status).toBe(200);
    const r = await c.call(me.GET, "GET", "/api/v1/me");
    expect(r.data.user.email).toBe("amina1@example.dz");
  });

  it("locks the account after repeated failures", async () => {
    const c = new Client();
    await c.call(register.POST, "POST", "/api/v1/auth/register", { body: newUser(2) });
    for (let i = 0; i < 10; i++) {
      await c.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina2@example.dz", password: "wrong-password" } });
    }
    const r = await c.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina2@example.dz", password: "S3cure-pass!" } });
    expect(r.status).toBe(423);
    expect(r.data.error.code).toBe("ACCOUNT_LOCKED");
    expect(r.res.headers.get("retry-after")).toBeTruthy();
  });

  it("reports AUTH_EXPIRED for an expired access token instead of downgrading to guest", async () => {
    const [u] = await db.select().from(users).where(eq(users.email, "amina1@example.dz"));
    const { SignJWT } = await import("jose");
    const expired = await new SignJWT({ role: "customer", tv: u.tokenVersion, sid: crypto.randomUUID() })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(u.id)
      .setIssuer("hanutek")
      .setAudience("hanutek-api")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    const c = new Client();
    c.jar.set(AT, { value: expired, path: "/" });
    const r = await c.call(me.GET, "GET", "/api/v1/me");
    expect(r.status).toBe(401);
    expect(r.data.error.code).toBe("AUTH_EXPIRED");
  });

  it("restores the session from the refresh cookie and rotates it", async () => {
    const c = new Client();
    await c.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "S3cure-pass!" } });
    const oldRt = c.cookie(RT)!;
    c.jar.delete(AT); // access token gone (expired cookie)
    const r = await c.call(session.POST, "POST", "/api/v1/auth/session");
    expect(r.data.user.email).toBe("amina1@example.dz");
    expect(c.cookie(AT)).toBeTruthy();
    expect(c.cookie(RT)).not.toBe(oldRt);
  });

  it("detects refresh-token reuse and revokes the whole family", async () => {
    const c = new Client();
    await c.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "S3cure-pass!" } });
    const stolen = c.cookie(RT)!;
    expect((await c.call(refresh.POST, "POST", "/api/v1/auth/refresh")).status).toBe(200);
    // Make the rotation "old" so it is outside the concurrent-tab grace window.
    await db.update(refreshSessions).set({ rotatedAt: new Date(Date.now() - 60_000) });
    const attacker = new Client();
    attacker.jar.set(RT, { value: stolen, path: "/api/v1/auth" });
    expect((await attacker.call(refresh.POST, "POST", "/api/v1/auth/refresh")).status).toBe(401);
    // The legitimate holder's newer token is now revoked too.
    expect((await c.call(refresh.POST, "POST", "/api/v1/auth/refresh")).status).toBe(401);
  });

  it("answers REFRESH_RACE (retry) when two tabs rotate concurrently", async () => {
    const c = new Client();
    await c.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "S3cure-pass!" } });
    const rt = c.cookie(RT)!;
    await c.call(refresh.POST, "POST", "/api/v1/auth/refresh");
    const tab2 = new Client();
    tab2.jar.set(RT, { value: rt, path: "/api/v1/auth" });
    const r = await tab2.call(refresh.POST, "POST", "/api/v1/auth/refresh");
    expect(r.status).toBe(409);
    expect(r.data.error.code).toBe("REFRESH_RACE");
    expect((await c.call(me.GET, "GET", "/api/v1/me")).status).toBe(200); // family intact
  });

  it("logout revokes the refresh session and clears cookies", async () => {
    const c = new Client();
    await c.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "S3cure-pass!" } });
    const rt = c.cookie(RT)!;
    await c.call(logout.POST, "POST", "/api/v1/auth/logout");
    expect(c.cookie(AT)).toBeUndefined();
    const replay = new Client();
    replay.jar.set(RT, { value: rt, path: "/api/v1/auth" });
    expect((await replay.call(refresh.POST, "POST", "/api/v1/auth/refresh")).status).toBe(401);
  });
});

describe("password recovery", () => {
  it("does not reveal whether an account exists", async () => {
    const a = await new Client().call(forgot.POST, "POST", "/api/v1/auth/password/forgot", { body: { email: "ghost@example.dz" } });
    const b = await new Client().call(forgot.POST, "POST", "/api/v1/auth/password/forgot", { body: { email: "amina1@example.dz" } });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.data).toEqual(b.data);
  });

  it("resets the password with a single-use link and signs out every device", async () => {
    const device = new Client();
    await device.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "S3cure-pass!" } });
    await new Client().call(forgot.POST, "POST", "/api/v1/auth/password/forgot", { body: { email: "amina1@example.dz" } });
    const mail = [...outbox].reverse().find((m) => m.to === "amina1@example.dz" && /mot de passe/.test(m.subject))!;
    const t = linkFrom(mail.text);
    const r = await new Client().call(reset.POST, "POST", "/api/v1/auth/password/reset", { body: { token: t, password: "Brand-new-pass1" } });
    expect(r.status).toBe(200);
    expect((await new Client().call(reset.POST, "POST", "/api/v1/auth/password/reset", { body: { token: t, password: "Another-pass-2" } })).status).toBe(400);
    expect((await device.call(me.GET, "GET", "/api/v1/me")).status).toBe(401); // tokenVersion bumped
    expect((await new Client().call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "Brand-new-pass1" } })).status).toBe(200);
  });

  it("changes password (requires current one) and keeps the current device signed in", async () => {
    const c = new Client();
    await c.call(login.POST, "POST", "/api/v1/auth/login", { body: { email: "amina1@example.dz", password: "Brand-new-pass1" } });
    const bad = await c.call(change.POST, "POST", "/api/v1/auth/password/change", { body: { currentPassword: "wrong", newPassword: "Changed-pass-3" } });
    expect(bad.status).toBe(401);
    const ok = await c.call(change.POST, "POST", "/api/v1/auth/password/change", { body: { currentPassword: "Brand-new-pass1", newPassword: "Changed-pass-3" } });
    expect(ok.status).toBe(200);
    expect((await c.call(me.GET, "GET", "/api/v1/me")).status).toBe(200);
  });
});

describe("bearer token flow (admin app)", () => {
  it("issues tokens in the body and accepts Authorization: Bearer without cookies", async () => {
    const server = new Client(null); // server-to-server: no Origin, no cookies
    const r = await server.call(token.POST, "POST", "/api/v1/auth/token", { body: { email: "admin@test.dz", password: "AdminPass!123" } });
    expect(r.status).toBe(200);
    const m = await server.call(me.GET, "GET", "/api/v1/me", { headers: { authorization: `Bearer ${r.data.accessToken}` } });
    expect(m.data.user.role).toBe("admin");
    const rr = await server.call(tokenRefresh.POST, "POST", "/api/v1/auth/token/refresh", { body: { refreshToken: r.data.refreshToken } });
    expect(rr.data.accessToken).toBeTruthy();
  });
});

describe("Google account linking", () => {
  it("links to an existing verified account by email", async () => {
    const r = await loginWithGoogle({ sub: "g-123", email: "AMINA1@example.dz", name: "Amina", locale: "fr" }, {});
    expect(r.user.email).toBe("amina1@example.dz");
    expect(r.user.googleLinked).toBe(true);
    expect(r.user.hasPassword).toBe(true);
  });

  it("wipes the password of an unverified pre-registered account (pre-hijack defence)", async () => {
    await new Client().call(register.POST, "POST", "/api/v1/auth/register", { body: { ...newUser(3), email: "victim@example.dz" } });
    const r = await loginWithGoogle({ sub: "g-victim", email: "victim@example.dz", name: "Victim", locale: "fr" }, {});
    expect(r.user.hasPassword).toBe(false);
    expect(r.user.emailVerified).toBe(true);
  });

  it("creates a verified account for a new Google user", async () => {
    const r = await loginWithGoogle({ sub: "g-new", email: "new.g@example.dz", name: "New Person", locale: "ar" }, {});
    expect(r.user).toMatchObject({ emailVerified: true, hasPassword: false, role: "customer" });
  });

  it("signs a tampered/forged token out", async () => {
    const forged = await signAccessToken({ sub: crypto.randomUUID(), role: "admin", tv: 0, sid: crypto.randomUUID() });
    const r = await new Client().call(me.GET, "GET", "/api/v1/me", { headers: { authorization: `Bearer ${forged}` } });
    expect(r.status).toBe(401); // unknown subject
  });
});
