import { randomUUID } from "node:crypto";
import { test, expect, uid, PASSWORD, registerVia, mailLink, outbox, expiredAccessToken, nextGoogleIdentity, gotoStore, pageApi, toastText, BASE, COOKIES } from "../support";

test.describe("accounts & sessions", () => {
  test("register → verify e-mail → logout → login → session survives reload and a new tab", async ({ page, context }) => {
    const email = `${uid("new.")}@example.dz`;
    await gotoStore(page, "/register");
    await page.getByLabel("Nom complet").fill("Amina Bouzid");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await page.getByLabel(/J’accepte les conditions/).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "Bonjour, Amina" })).toBeVisible();
    await expect(page.getByText("Confirmez votre adresse e-mail")).toBeVisible();

    // the verification mail was really sent, and its single-use link works once
    const started = Date.now() - 60_000;
    const link = await mailLink(email, /Confirmez votre adresse e-mail/, started);
    await page.goto(link);
    await expect(page.getByText("Votre adresse e-mail est confirmée")).toBeVisible();
    await page.goto(link);
    await expect(page.getByText("Ce lien est invalide ou a expiré.")).toBeVisible();
    await gotoStore(page, "/profile");
    await expect(page.getByText("Confirmez votre adresse e-mail")).toHaveCount(0);

    // reload + a brand-new tab restore the session from cookies
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bonjour, Amina" })).toBeVisible();
    const tab = await context.newPage();
    await gotoStore(tab, "/profile");
    await expect(tab.getByRole("heading", { name: "Bonjour, Amina" })).toBeVisible();
    await tab.close();

    // logout clears the session server-side: the old refresh token is revoked
    const refresh = (await context.cookies()).find((c) => c.name === COOKIES.refresh)!;
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/$/);
    const replay = await page.request.post("/api/v1/auth/refresh", { headers: { origin: BASE, cookie: `${COOKIES.refresh}=${refresh.value}` } });
    expect(replay.status()).toBe(401);
    await gotoStore(page, "/profile");
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)profile/);

    // and logging back in works with the same credentials
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(toastText(page, "Content de vous revoir")).toBeVisible();
  });

  test("invalid credentials, unknown account and duplicate registration give clear, non-enumerating errors", async ({ page }) => {
    const c = await registerVia(page.context().request);
    await page.context().clearCookies();

    await gotoStore(page, "/login");
    await page.getByLabel("E-mail", { exact: true }).fill(c.email);
    await page.getByLabel("Mot de passe", { exact: true }).fill("wrong-password-1");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("E-mail ou mot de passe incorrect");

    await page.getByLabel("E-mail", { exact: true }).fill(`${uid("ghost.")}@example.dz`);
    await page.getByRole("button", { name: "Se connecter" }).click();
    // same message for an account that does not exist
    await expect(page.locator("main").getByRole("alert")).toHaveText("E-mail ou mot de passe incorrect");

    // client-side validation happens before any request
    await page.getByLabel("E-mail", { exact: true }).fill("not-an-email");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Saisissez une adresse e-mail valide");

    await gotoStore(page, "/register");
    await page.getByLabel("Nom complet").fill("Someone Else");
    await page.getByLabel("E-mail", { exact: true }).fill(c.email.toUpperCase()); // case-insensitive uniqueness
    await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await page.getByLabel(/J’accepte les conditions/).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Un compte existe déjà avec cet e-mail");
  });

  test("register shows the server's field error instead of a generic password message", async ({ page }) => {
    await gotoStore(page, "/register");
    await page.getByLabel("Nom complet").fill("Rachid Saadi");
    // passes the browser regex but is rejected by the server's e-mail validator
    await page.getByLabel("E-mail", { exact: true }).fill("rachid@exa_mple.dz");
    await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await page.getByLabel(/J’accepte les conditions/).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Saisissez une adresse e-mail valide");
  });

  test("password recovery: mail link resets once, signs every other device out", async ({ page, browser }) => {
    const c = await registerVia(page.context().request);
    // a second device signed in as the same customer
    const other = await browser.newContext({ baseURL: BASE });
    await other.request.post("/api/v1/auth/login", { data: { email: c.email, password: c.password }, headers: { origin: BASE } });
    expect((await other.request.get("/api/v1/me")).status()).toBe(200);
    await page.context().clearCookies();

    await gotoStore(page, "/forgot-password");
    const started = Date.now() - 1000;
    await page.getByLabel("E-mail", { exact: true }).fill(c.email);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Si un compte existe" })).toBeVisible();

    // unknown e-mail: same answer, no mail
    await gotoStore(page, "/forgot-password");
    const ghost = `${uid("ghost.")}@example.dz`;
    await page.getByLabel("E-mail", { exact: true }).fill(ghost);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Si un compte existe" })).toBeVisible();
    expect(outbox(ghost)).toHaveLength(0);

    const link = await mailLink(c.email, /Réinitialisation/, started);
    await gotoStore(page, link);
    await page.getByLabel("Nouveau mot de passe").fill("Brand-new-pass-77");
    await page.getByLabel("Confirmer le mot de passe").fill("Brand-new-pass-7");
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Les mots de passe ne correspondent pas");
    await page.getByLabel("Confirmer le mot de passe").fill("Brand-new-pass-77");
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // the other device lost its session; the old password no longer works; the link is spent
    expect((await other.request.get("/api/v1/me")).status()).toBe(401);
    await other.close();
    const old = await page.request.post("/api/v1/auth/login", { data: { email: c.email, password: c.password }, headers: { origin: BASE } });
    expect(old.status()).toBe(401);
    await page.goto(link);
    await page.getByLabel("Nouveau mot de passe").fill("Another-pass-88");
    await page.getByLabel("Confirmer le mot de passe").fill("Another-pass-88");
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Ce lien est invalide ou a expiré.");

    await gotoStore(page, "/login");
    await page.getByLabel("E-mail", { exact: true }).fill(c.email);
    await page.getByLabel("Mot de passe", { exact: true }).fill("Brand-new-pass-77");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("an expired access token is refreshed transparently — the cart never flips to a guest cart", async ({ page, context, admin }) => {
    const p = await admin.product();
    await registerVia(context.request);
    await gotoStore(page, `/products/${p.slug}`);
    await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
    await expect(toastText(page, "Ajouté au panier")).toBeVisible();

    const me = await pageApi<{ user: { id: string } }>(page, "GET", "/me");
    const at = (await context.cookies()).find((c) => c.name === COOKIES.access)!;
    await context.addCookies([{ ...at, value: await expiredAccessToken(me.json.user.id, randomUUID()) }]);

    // a direct API call with the expired token says AUTH_EXPIRED, never "guest"
    const raw = await pageApi<{ error: { code: string } }>(page, "GET", "/cart");
    expect(raw.status).toBe(401);
    expect(raw.json.error.code).toBe("AUTH_EXPIRED");

    // the app bootstrap rotates the refresh token and keeps the user + their cart
    await gotoStore(page, "/cart");
    await expect(page.getByRole("heading", { name: /Panier/ })).toContainText("(1)");
    await expect(page.getByRole("link", { name: p.name }).first()).toBeVisible();
    expect((await pageApi(page, "GET", "/me")).status).toBe(200);
  });

  test("refresh rotation: a concurrent-tab race is a retryable 409, a forged or revoked token signs the shopper out cleanly", async ({ page, context, browser }) => {
    await registerVia(context.request);
    const old = (await context.cookies()).find((c) => c.name === COOKIES.refresh)!.value;
    expect((await context.request.post("/api/v1/auth/refresh", { headers: { origin: BASE } })).status()).toBe(200);

    // replaying the just-rotated token inside the grace window = another tab won the race
    const bare = await browser.newContext({ baseURL: BASE });
    const race = await bare.request.post("/api/v1/auth/refresh", { headers: { origin: BASE, cookie: `${COOKIES.refresh}=${old}` } });
    expect(race.status()).toBe(409);
    expect((await race.json()).error.code).toBe("REFRESH_RACE");
    // …and the legitimate session is untouched
    expect((await context.request.get("/api/v1/me")).status()).toBe(200);

    // a forged refresh cookie: 401 and the cookies are cleared
    const forged = await bare.request.post("/api/v1/auth/refresh", { headers: { origin: BASE, cookie: `${COOKIES.refresh}=forged-token-value` } });
    expect(forged.status()).toBe(401);
    expect(forged.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value).join("\n")).toMatch(/__Secure-ht_rt=;.*Max-Age=0/);
    await bare.close();

    // after logout the app with only a dead refresh cookie boots as a guest, without errors
    await page.request.post("/api/v1/auth/logout", { headers: { origin: BASE } });
    await gotoStore(page, "/");
    await expect(page.getByRole("link", { name: "Profil" }).or(page.getByRole("link", { name: "Mon compte" })).first()).toHaveAttribute("href", /\/(login|profile)/);
    expect((await pageApi(page, "GET", "/me")).status).toBe(401);
  });

  test("Google sign-in: new account, linking an existing one, cancel and unverified e-mail", async ({ page }) => {
    // 1. brand-new Google user → account created, lands on the requested page
    const g = { sub: uid("g-"), email: `${uid("gmail.")}@example.dz`, name: "Imane Rahmani", email_verified: true };
    await nextGoogleIdentity(g);
    await gotoStore(page, "/login?next=%2Ffavorites");
    await page.getByRole("link", { name: "Continuer avec Google" }).click();
    await expect(page).toHaveURL(/\/favorites$/);
    const me = await pageApi<{ user: { email: string; emailVerified: boolean; googleLinked: boolean; hasPassword: boolean } }>(page, "GET", "/me");
    expect(me.json.user).toMatchObject({ email: g.email, emailVerified: true, googleLinked: true, hasPassword: false });

    // 2. existing password account with the same verified e-mail → linked, password kept
    await page.context().clearCookies();
    const existing = await registerVia(page.context().request);
    await page.context().clearCookies();
    // mark it verified through the real flow
    await page.request.post("/api/v1/auth/login", { data: { email: existing.email, password: existing.password }, headers: { origin: BASE } });
    await page.request.post("/api/v1/auth/verify-email/resend", { headers: { origin: BASE } });
    await page.goto(await mailLink(existing.email, /Confirmez/));
    await expect(page.getByText("Votre adresse e-mail est confirmée")).toBeVisible();
    await page.context().clearCookies();
    await nextGoogleIdentity({ sub: uid("g-"), email: existing.email, name: "Linked", email_verified: true });
    await gotoStore(page, "/login");
    await page.getByRole("link", { name: "Continuer avec Google" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    const linked = await pageApi<{ user: { googleLinked: boolean; hasPassword: boolean } }>(page, "GET", "/me");
    expect(linked.json.user).toMatchObject({ googleLinked: true, hasPassword: true });

    // 3. user cancels on Google's screen → back on login, no error banner
    await page.context().clearCookies();
    await nextGoogleIdentity({ error: "access_denied" });
    await gotoStore(page, "/login");
    await page.getByRole("link", { name: "Continuer avec Google" }).click();
    await expect(page).toHaveURL(/\/login\?error=google_cancelled/);
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);

    // 4. Google account whose e-mail is not verified → refused
    await nextGoogleIdentity({ sub: uid("g-"), email: `${uid("unverified.")}@example.dz`, email_verified: false });
    await page.getByRole("link", { name: "Continuer avec Google" }).click();
    await expect(page).toHaveURL(/\/login\?error=google_failed/);
    await expect(page.locator("main").getByRole("alert")).toHaveText("La connexion avec Google a échoué. Réessayez.");
    expect((await pageApi(page, "GET", "/me")).status).toBe(401);
  });

  test("Google callback rejects a forged state (CSRF on the OAuth flow)", async ({ page }) => {
    const res = await page.request.get("/api/v1/auth/google/callback?code=abc&state=forged", { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()["location"]).toMatch(/\/login\?error=google_state$/);
  });

  test("profile edits persist across reload and a fresh sign-in", async ({ page, context }) => {
    const c = await registerVia(context.request);
    await gotoStore(page, "/profile?tab=settings");
    await page.getByLabel("Nom affiché").fill("Nesrine Khelifi");
    await page.getByLabel(/Téléphone/).fill("0661 22 33 44");
    await page.getByLabel("Adresse", { exact: true }).fill("5 Cité des Orangers");
    await page.getByLabel("Commune").fill("Oran");
    await page.getByRole("button", { name: "Wilaya" }).click();
    await page.getByRole("option", { name: /^31 — / }).click();
    await page.getByLabel("Code postal").fill("abc");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Code postal à 5 chiffres")).toBeVisible();
    await page.getByLabel("Code postal").fill("31000");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(toastText(page, "Profil mis à jour")).toBeVisible();

    await context.clearCookies();
    await context.request.post("/api/v1/auth/login", { data: { email: c.email, password: c.password }, headers: { origin: BASE } });
    await gotoStore(page, "/profile?tab=settings");
    await expect(page.getByRole("heading", { name: "Bonjour, Nesrine" })).toBeVisible();
    await expect(page.getByLabel(/Téléphone/)).toHaveValue("0661223344");
    await expect(page.getByLabel("Adresse", { exact: true })).toHaveValue("5 Cité des Orangers");
    await expect(page.getByRole("button", { name: "Wilaya" })).toContainText("31 — Oran");
  });

  test("change password: wrong current password is refused, success keeps this device signed in", async ({ page, context }) => {
    const c = await registerVia(context.request);
    await gotoStore(page, "/profile?tab=settings");
    await page.getByLabel("Mot de passe actuel").fill("not-it-at-all");
    await page.getByLabel("Nouveau mot de passe").fill("Changed-pass-2027");
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Mot de passe actuel incorrect");
    await page.getByLabel("Mot de passe actuel").fill(c.password);
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(toastText(page, "Mot de passe mis à jour")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  });
});
