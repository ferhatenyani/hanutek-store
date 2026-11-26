/**
 * Stand-in Google OpenID provider for the E2E suite (the app points at it via
 * GOOGLE_OIDC_BASE). It behaves like the real one where the app's security
 * depends on it: RS256-signed ID tokens published through a JWKS, the nonce
 * echoed into the token, PKCE (S256) and the client secret checked on the
 * code exchange, one-time codes.
 *
 * Tests choose who signs in next:  POST /__next  {sub,email,name,email_verified}
 * or {error:"access_denied"}. Without one, a default verified identity is used.
 */
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

const port = Number(process.env.OIDC_PORT ?? 3299);
const base = `http://localhost:${port}`;
const clientId = process.env.GOOGLE_CLIENT_ID ?? "e2e-client";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "e2e-secret";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "e2e-1", alg: "RS256", use: "sig" };

let queued = [];
const codes = new Map();
const DEFAULT = { sub: "google-default", email: "google.default@example.dz", name: "Google Default", email_verified: true };

const body = (req) =>
  new Promise((resolve) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => resolve(s));
  });
const send = (res, status, data, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(data === undefined ? "" : JSON.stringify(data));
};

createServer(async (req, res) => {
  const url = new URL(req.url, base);
  try {
    if (req.method === "POST" && url.pathname === "/__next") {
      queued.push(JSON.parse((await body(req)) || "{}"));
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/__reset") {
      queued = [];
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/certs") return send(res, 200, { keys: [jwk] });

    if (url.pathname === "/o/oauth2/v2/auth") {
      const q = url.searchParams;
      const redirect = new URL(q.get("redirect_uri"));
      if (q.get("client_id") !== clientId || q.get("code_challenge_method") !== "S256" || !q.get("code_challenge")) {
        return send(res, 400, { error: "invalid_request" });
      }
      const who = queued.shift() ?? DEFAULT;
      redirect.searchParams.set("state", q.get("state") ?? "");
      if (who.error) redirect.searchParams.set("error", who.error);
      else {
        const code = randomBytes(16).toString("base64url");
        codes.set(code, { who, nonce: q.get("nonce"), challenge: q.get("code_challenge"), redirect: q.get("redirect_uri") });
        redirect.searchParams.set("code", code);
      }
      res.writeHead(302, { location: redirect.toString() });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/token") {
      const f = new URLSearchParams(await body(req));
      const entry = codes.get(f.get("code") ?? "");
      codes.delete(f.get("code") ?? ""); // one-time
      if (!entry || f.get("client_id") !== clientId || f.get("client_secret") !== clientSecret || f.get("redirect_uri") !== entry.redirect) {
        return send(res, 400, { error: "invalid_grant" });
      }
      const verifier = f.get("code_verifier") ?? "";
      if (createHash("sha256").update(verifier).digest("base64url") !== entry.challenge) return send(res, 400, { error: "invalid_grant" });
      const { sub, email, name, email_verified, nonce } = { ...entry.who, nonce: entry.who.nonce ?? entry.nonce };
      const idToken = await new SignJWT({ email, name, email_verified, nonce })
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
        .setIssuer(entry.who.iss ?? base)
        .setAudience(entry.who.aud ?? clientId)
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      return send(res, 200, { id_token: idToken, token_type: "Bearer" });
    }
    send(res, 404, { error: "not_found" });
  } catch (err) {
    send(res, 500, { error: String(err) });
  }
}).listen(port, () => console.log(`[e2e] mock OIDC provider on ${base}`));
