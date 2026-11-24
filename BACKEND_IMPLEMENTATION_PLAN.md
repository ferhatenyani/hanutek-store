# hanutek — Backend Implementation Plan & Status

Living document for the storefront backend. Last updated: 2026-11-24.

**Status: implemented and integrated.** 67 automated API tests, a 28-check HTTP journey and a 17-step browser smoke test pass against a production build.

---

## 1. Scope decisions

| Topic | Decision |
|---|---|
| Payments | **Cash on delivery only.** No online payment provider for now. `payment_method` is an enum (`cod`), so a provider can be added later without schema churn. |
| Delivery fees | **Not shown to customers and not charged at checkout.** `orders.shipping_fee` exists (defaults to 0) and staff can set it via the admin API. Yalidine / ZR Express pricing will be integrated once those accounts exist. |
| Carriers | Staff record `carrier` + `tracking_number` when shipping; the customer timeline shows them. No carrier API integration yet. |
| Admin frontend | Not built. The API, RBAC, and audit log are ready for it. |

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime / API | **Next.js 16 Route Handlers** (`/api/v1/*`) in the existing app | One deployable, no CORS for the storefront, and Server Components call services directly (no HTTP hop). The admin app consumes the same versioned API. |
| Business logic | Framework-free services in `src/server/services` | Testable without Next; reusable by a future worker/admin. |
| Database | **PostgreSQL** | Transactions, row locks, partial and unique indexes, JSONB for localized specs. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Typed SQL with no query-engine binary; SQL migrations in `/drizzle`. |
| Local DB / tests | **PGlite** (Postgres compiled to WASM) | Real Postgres semantics without Docker; every test file gets an isolated in-memory DB. |
| Auth | In-house: **JWT access tokens (jose, HS256, 15 min)** + **rotating opaque refresh tokens** in httpOnly cookies; **Argon2id** passwords | Full control of revocation, reuse detection, and cookie policy. |
| Google sign-in | OIDC code flow + PKCE + nonce, ID token verified against Google JWKS | No third-party auth SaaS. |
| Validation | **zod** on every input | |
| Images | **sharp** → WebP 320/800/1600 px; storage: local disk or **S3-compatible (Cloudflare R2)** via `aws4fetch` | R2 has no egress fees; a CDN sits in front. |
| E-mail | Console driver (dev) / **Resend** HTTP API (prod) | |
| Rate limiting | Postgres fixed-window counters (single atomic UPSERT) | Works across instances with no Redis. |
| Tests | **Vitest** (API/integration), **playwright-core** with the system Chrome (UI smoke) | |

---

## 3. Architecture

```
src/
  app/
    api/v1/...            Route handlers (thin: validate → service → JSON)
    page.tsx, products/   Server Components read cached services (ISR + tag revalidation)
    */                    Client views talk to /api/v1 through src/lib/api.ts
  server/                 server-only
    env.ts                zod-validated environment (fails fast in production)
    db/schema.ts          Drizzle schema · db/client.ts (pg | PGlite) · db/seed/
    auth/                 password, tokens (JWT), session (refresh rotation), cookies, google, rbac
    lib/http.ts           route() wrapper: auth, RBAC, CSRF, rate limits, body limits, errors, logs
    services/             catalog, cart, promotions, orders, accounts, favorites, reviews,
                          media, mail, audit, admin-catalog, admin-ops, newsletter
    queries.ts            unstable_cache wrappers tagged "catalog"
    validation.ts         request schemas
  lib/
    api.ts                browser fetch client (refresh single-flight, typed errors)
    api-types.ts          DTOs shared by server and client
    store.tsx             client store (session bootstrap, optimistic cart, favorites)
  proxy.ts                CORS for ADMIN_ORIGINS on /api
```

**Request pipeline (`route()`):** request id → CSRF check → resolve identity (cookie or Bearer) → RBAC → rate limits → zod-validated body/query → service → JSON. `AppError`s map to `{ error: { code, message, fields? } }`; anything else becomes a generic 500 with the details only in logs.

**Rendering:** home, listing and product pages are Server Components reading the DB through `unstable_cache` (tag `catalog`, 5-minute safety revalidate). Admin writes, reviews, checkouts and cancellations call `revalidateTag("catalog")` so prices and stock refresh immediately. User-specific data (session, cart, orders) is fetched client-side, which keeps catalog pages cacheable.

**Localization:** product, category and variant copy lives in `*_translations` tables. DTOs carry `{ fr, ar }` together, so the existing instant client-side language switch keeps working with no refetch.

---

## 4. Database schema

All money is **integer DZD**. Every table has `created_at`, and mutable tables also have `updated_at`.

| Table | Purpose / key constraints |
|---|---|
| `users` | email (unique, lower-cased), password_hash (argon2id, nullable for Google-only), google_sub (unique), role `customer/staff/admin`, status, `token_version` (bump = revoke all access tokens), lockout counters |
| `refresh_sessions` | sha256 of refresh token (unique), `family_id`, rotated_at / revoked_at, ip, user agent |
| `verification_tokens` | email-verify / password-reset, sha256 hashed, single-use, expiring |
| `addresses` | per-user, partial unique index = at most one default |
| `categories`, `category_translations` | slug unique, parent_id (tree-ready), position, active flag |
| `products`, `product_translations` | slug unique, status `draft/active/archived`, flags; denormalized `min_price`, `on_sale`, `rating_avg`, `rating_count` |
| `product_variants`, `variant_translations` | (product, code) unique, SKU unique, price, compare_at, **stock CHECK ≥ 0**, attributes JSONB |
| `product_images` | url + WebP renditions JSON, storage key, dimensions, position |
| `carts`, `cart_items` | one cart per user, or per guest token hash; qty CHECK 1–10; (cart, variant) unique |
| `favorites` | (user, product) PK |
| `promotions`, `promotion_redemptions` | percent/fixed, min subtotal, max discount, window, global + per-customer limits (user id or phone) |
| `orders` | number `HT-XXXXXX` unique, **idempotency key unique**, status enum, COD payment status, totals, contact/address snapshot, carrier/tracking, guest access hash |
| `order_items` | snapshots: slug, name, localized variant label, SKU, image, unit price |
| `order_events` | status history (powers the tracking timeline) + actor |
| `reviews` | (product, user) unique, rating CHECK 1–5, verified via a delivered order, moderation status |
| `inventory_movements` | stock ledger: delta, stock_after, reason, order/actor |
| `audit_logs` | admin actions with before/after JSON, actor, ip, user agent |
| `rate_limits` | rate-limit buckets |
| `newsletter_subscribers` | footer newsletter |

Indexes cover every lookup path: slug and code uniques, category+status, status+price, user+placed_at, status+placed_at, phone, review listing, audit by entity, actor and date.

Migrations: `drizzle/0000_init.sql`, `drizzle/0001_newsletter.sql`.

---

## 5. API (`/api/v1`)

### Public / customer
| Method & path | Notes |
|---|---|
| `POST auth/register` · `auth/login` · `auth/logout` · `auth/refresh` | cookie sessions; guest cart is merged on sign-in |
| `POST auth/session` | **bootstrap**: user + cart + favorites + features; restores an expired session via the refresh cookie |
| `POST auth/verify-email` · `auth/verify-email/resend` | single-use 24 h link |
| `POST auth/password/forgot` · `auth/password/reset` · `auth/password/change` | reset revokes every session; change keeps the current device |
| `GET auth/google/start` · `auth/google/callback` | OIDC + PKCE |
| `POST auth/token` · `auth/token/refresh` | **Bearer flow for the admin app's server** (tokens in body) |
| `GET/PATCH me` · `GET me/orders` · `GET me/addresses` | |
| `GET/POST me/favorites` · `PUT/DELETE me/favorites/{slug}` | POST merges guest favorites |
| `GET categories` · `GET products` (category, q, sale, sort, page, pageSize) · `GET products/{slug}` · `GET products/by-slugs` | public, HTTP-cacheable |
| `GET/POST products/{slug}/reviews` · `DELETE reviews/{id}` | verified buyers only |
| `GET search/suggest?q=` | |
| `GET cart` · `POST cart/items` · `PATCH/DELETE cart/items/{variantId}` · `POST/DELETE cart/promo` | |
| `POST orders` | checkout (COD), idempotent |
| `GET orders/{number}` · `POST orders/{number}/cancel` | owner, or guest with `X-Order-Key` |
| `POST newsletter` · `GET health` | |

### Admin (Bearer token or cookie; permission-checked)
| Path | Permission |
|---|---|
| `GET admin/stats` | orders:read |
| `GET/POST admin/products` · `GET/PATCH/DELETE admin/products/{id}` | catalog:read / catalog:write (DELETE archives) |
| `POST/PUT admin/products/{id}/images` · `DELETE …/images/{imageId}` | media:write (multipart upload → WebP) |
| `GET/POST admin/variants/{id}/stock` | inventory:write (ledger) |
| `GET/POST admin/categories` · `PUT admin/categories/{slug}` | catalog:write |
| `GET admin/orders` (status, q, from, to) · `GET/PATCH admin/orders/{number}` · `POST …/status` | orders:read / orders:write |
| `GET admin/customers` · `GET/PATCH admin/customers/{id}` | customers:read / customers:write (roles: admin only) |
| `GET/POST admin/promotions` · `PATCH admin/promotions/{id}` | promotions:write |
| `PATCH admin/reviews/{id}` | reviews:moderate |
| `GET admin/audit` | audit:read |

**Roles:** `customer` (none) · `staff` (catalog, inventory, orders, customers:read, reviews, media) · `admin` (everything, including promotions, roles and audit). Defined in `src/server/auth/rbac.ts`.

**Order lifecycle:** `pending → confirmed → packed → shipped → out_for_delivery → delivered`; `cancelled` is allowed until shipped (stock and promo use are restored); `returned` after shipping (stock restored). Customers can cancel while `pending`/`confirmed`. Delivering marks COD as `paid`.

---

## 6. Security measures

- **Passwords:** Argon2id (19 MiB, t=2). Timing-equalized verification for unknown users. 8–128 characters.
- **Brute force:** per-IP and per-account login buckets, plus account lockout (10 failures → 15 min). Rate limits on register, reset, e-mail sends, checkout, promo, cart, reviews, search, order lookup and uploads.
- **Tokens:** 15-minute access JWTs (iss/aud/alg pinned, `alg=none` rejected). `token_version` gives instant revocation (password reset, disable, role change). Refresh tokens are opaque and stored as sha256 hashes. They rotate on every use; reuse of a rotated token revokes the whole family, with a 20 s grace window for concurrent tabs.
- **Cookies:** httpOnly. In production they are `Secure` and use the `__Host-`/`__Secure-` prefixes. The refresh cookie is `SameSite=Strict`, scoped to `/api/v1/auth`.
- **CSRF:** SameSite cookies plus a strict Origin / `Sec-Fetch-Site` check on every cookie-authenticated mutation. Cookieless Bearer calls are exempt.
- **IDOR:** orders are visible only to their owner, staff, or a guest holding the HMAC access key. Everything else returns **404** (no enumeration). Guest keys travel in a header and are stripped from URLs.
- **Mass assignment:** zod strips unknown keys, so `role` can never be set by a customer.
- **SQL injection:** parameterized Drizzle queries only; LIKE wildcards are escaped.
- **XSS:** React escaping and no user HTML. CSP: `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action 'self'`. Script-src keeps `'unsafe-inline'`, a documented trade-off: nonce-based CSP would disable static/ISR pages.
- **Headers:** HSTS (preload), nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP; `x-powered-by` removed.
- **Open redirects:** `next` parameters are accepted only as same-site relative paths, on both server and client.
- **Uploads:** magic-byte sniffing (SVG/HTML rejected), 10 MB and 40 MP limits (decompression-bomb guard), EXIF stripped, re-encoded to WebP, random file names, orphaned files removed on failure.
- **Google linking:** linking to an *unverified* local account wipes its password and sessions (pre-hijack defence).
- **Data integrity:** checkout runs in one transaction. Variant rows are locked in a stable order, stock is decremented with a `stock >= qty` guard plus a CHECK constraint, promo usage is incremented conditionally, and the idempotency key is unique. Concurrent identical submits return the same order.
- **Proxy trust:** client IP comes from `X-Forwarded-For` only for the configured number of hops.
- **Secrets:** server-only modules (`server-only` guard), env validated at boot, nothing secret in `NEXT_PUBLIC_*`.
- **Errors/logging:** structured JSON logs with request ids. Clients never receive stack traces.

---

## 7. Frontend integration

| Area | Status |
|---|---|
| Catalog (home rails, listing filters/sort/search/"see more", product detail, related) | ✅ server-rendered from DB, cached and tag-revalidated |
| Search suggestions | ✅ debounced, abortable, cached per query |
| Cart (page + sheet) | ✅ server-priced, stock-aware, optimistic with sequence guard, debounced qty, guest cart merge |
| Promo codes | ✅ real validation (limits, minimums, windows) |
| Checkout | ✅ COD, idempotent, field-level server errors, address prefill/save, stock/promo change handling. Delivery-fee UI removed by request. |
| Order confirmation & tracking | ✅ server timeline, carrier/tracking number, guest access key, customer cancellation |
| Auth (register, login, logout, Google, forgot/reset, verify e-mail) | ✅ new pages: `/forgot-password`, `/reset-password`, `/verify-email` |
| Session restoration / expiry | ✅ bootstrap refresh plus transparent single-flight refresh on `AUTH_EXPIRED` |
| Profile (orders, settings, default address, password) | ✅ |
| Favorites | ✅ server for accounts, localStorage for guests, merged on sign-in |
| Reviews | ✅ new accordion section on product pages (verified buyers) |
| Newsletter | ✅ stored server-side |
| Copy | Demo/mock wording removed (fr + ar). Product copy moved from the i18n bundle into the DB. |

UI changes beyond wiring: the Apple button was removed (only Google was requested); the Google button appears only when configured; sold-out states were added to cards and detail; the checkout "delivery speed" section and shipping rows were removed.

---

## 8. Tests

| Suite | What it covers | Result |
|---|---|---|
| `tests/auth.test.ts` (20) | register, validation, verification, generic login errors, lockout, AUTH_EXPIRED, session restore + rotation, reuse detection, concurrent-tab race, logout, reset, change, Bearer flow, Google linking rules, forged tokens | ✅ |
| `tests/commerce.test.ts` (19) | listing/filters/sort/search, LIKE/SQL literals, detail, suggest, guest cart, caps, out of stock, promo, checkout validation, order snapshot, stock ledger, idempotency, **no overselling under concurrency**, usage + per-phone limits, cart merge | ✅ |
| `tests/orders-admin.test.ts` (12) | IDOR (account + guest), cancellation restock, staff lifecycle + audit, closed-order guard, reviews (verified, unique, moderation, rating), favorites, RBAC (customer/staff/admin), disabling revokes sessions, self-demotion guard, admin product/stock/image upload (WebP), malicious upload | ✅ |
| `tests/security.test.ts` (16) | CSRF, content type, malformed JSON, body cap, mass assignment, request ids, `alg=none`/wrong key, rate limiting + Retry-After, open-redirect guard, proxy-IP trust, discount math, phone normalization, timeline, magic bytes | ✅ |
| `scripts/ui-smoke.mjs` (17 steps) | real browser on a production build: browse, filter, search, quick add, variant add, reviews, promo, guest checkout, order reopen + cancel, register, settings, favorites, logout/login, wrong password, Arabic RTL; fails on any console/page error | ✅ |
| HTTP journey (28 checks) | same flows over raw HTTP with a cookie jar, plus CORS/CSRF/RBAC spot checks | ✅ |

Commands: `npm test` · `npm run test:ui -- http://localhost:3123` (needs a running server) · `npm run typecheck` · `npm run lint`.

> On Windows, `npm test` goes through `scripts/vitest.mjs`, which normalizes a lowercase drive letter (VS Code terminals). Without it, Vitest loads itself twice.

---

## 9. Outstanding issues & limitations

1. **Concurrency tests run on PGlite**, which uses a single connection, so concurrent transactions are serialized. The oversell and idempotency guarantees rely on Postgres row locks plus guarded updates and unique constraints, which are correct on real Postgres, but the suite has not run against a real Postgres server. **Run it once in CI against Postgres before launch** (pointing `freshDb()` at a per-test schema).
2. **Delivery fees / carrier APIs (Yalidine, ZR Express)** are intentionally not implemented yet (see §1).
3. **No transactional e-mails for orders** (confirmation/shipping). Only verification and reset e-mails exist. Guests who open their order on another device need the access-key link, and there is no e-mail to carry it yet.
4. **CSP allows inline scripts** (see §6). Moving to nonces means dynamic rendering for every page.
5. **Search uses `ILIKE`**, which is fine for hundreds of products. Add `pg_trgm` / full-text indexes when the catalog grows.
6. **Local image storage** only works on a single server. Use `STORAGE_DRIVER=s3` (R2) for anything multi-instance.
7. **Admin MFA** is not implemented. Recommended before giving staff accounts to others.
8. Legal pages, social links and the footer's legal entries show "coming soon".
9. Orphan guest carts are not purged automatically. Add a periodic `DELETE FROM carts WHERE user_id IS NULL AND updated_at < now() - interval '60 days'`.

---

## 10. Environment variables

See `.env.example` for the full annotated list. Required in production: `APP_URL` (https), `DATABASE_URL` (Postgres), `JWT_SECRET` (≥32 random bytes). Optional: `GOOGLE_CLIENT_ID/SECRET`, `MAIL_DRIVER=resend` + `RESEND_API_KEY` + `MAIL_FROM`, `STORAGE_DRIVER=s3` + `S3_*` + `MEDIA_PUBLIC_URL`, `TRUST_PROXY_HOPS`, `ADMIN_ORIGINS`, `SEED_ADMIN_EMAIL/PASSWORD`, `LOG_LEVEL`.

---

## 11. Deployment

Recommended: a small **EU VPS (Hetzner/OVH, close to Algeria) or a container platform**, **managed PostgreSQL** (or Postgres on the same VPS with backups), **Cloudflare R2 + CDN** for images, Cloudflare/nginx in front for TLS. Vercel + Neon also works (set `STORAGE_DRIVER=s3`).

```bash
npm ci
npm run db:migrate                    # apply SQL migrations (DATABASE_URL)
SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… npm run db:seed   # first deploy only, idempotent
npm run build                         # needs DATABASE_URL + JWT_SECRET (catalog pages prerender from the DB)
npm start                             # behind nginx; see DEPLOYMENT.md for the full VPS setup
```

Checklist: `TRUST_PROXY_HOPS=1` behind one proxy · Google OAuth redirect URI `https://<domain>/api/v1/auth/google/callback` · Resend domain verified (SPF/DKIM) · daily Postgres backups · uptime check on `/api/v1/health` · never set `LOCAL_PREVIEW` on a server.

Local: `cp .env.example .env` → `npm run db:setup` → `npm run dev` (embedded PGlite in `.data/`, migrations applied automatically; e-mails, including verification and reset links, are printed to the console).

---

## 12. Milestones

| # | Milestone | Status |
|---|---|---|
| M1 | Stack, schema, migrations, seed (catalog migrated from the static data and fr/ar copy) | ✅ |
| M2 | Auth: sessions, refresh rotation, verification, reset, Google, RBAC | ✅ |
| M3 | Catalog, cart, promotions, checkout (COD), orders, inventory ledger | ✅ |
| M4 | Reviews, favorites, newsletter, media pipeline, admin API, audit log | ✅ |
| M5 | Security hardening (CSRF, rate limits, headers, CSP, CORS) | ✅ |
| M6 | Frontend integration (all pages), demo copy removal | ✅ |
| M7 | Automated tests (API, HTTP journey, browser smoke) | ✅ |
| Next | Carrier pricing (Yalidine / ZR Express), order e-mails, admin app, admin MFA, Postgres-backed CI run | ⏳ |
