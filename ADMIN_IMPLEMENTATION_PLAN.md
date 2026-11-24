# hanutek — Admin Console: Implementation Plan & Status

Living document for the admin application. Last updated: 2026-11-24.

**Status: implemented and wired to the real backend.** See §8 for test results and §9 for open items.

---

## 1. Decisions

| Topic | Decision | Why |
|---|---|---|
| Where it lives | `/admin/*` inside the existing Next.js app | Same origin as the API: httpOnly cookie auth, no CORS, one deploy. The storefront moved into a `(store)` route group (URLs unchanged) so the admin has its own shell, fonts and providers. |
| Data access | Client components calling `/api/v1/admin/*` through `src/admin/lib/client.ts` | Reuses the existing API, RBAC and audit trail; access tokens refresh transparently. Server components can't refresh tokens because the refresh cookie is scoped to `/api/v1/auth`. |
| Authorization | Server-side on every API call (`route({ auth: { permission } })`); the UI only hides what the role can't use | The console never relies on client checks for security. |
| State | URL is the source of truth for filters, sort, page and tabs; a small cache (`useApi`) with stale-while-revalidate, "keep previous data" and prefix invalidation | Shareable URLs, back button works, no extra dependency (no React Query). |
| Charts | Hand-written SVG (trend, bar list, segment bar, sparkline) | No chart dependency; flat fills, no gradients. |
| Design | Neutral greys, one ink colour, muted status hues; Geist + Geist Mono; light and dark themes via CSS variables scoped to `.adm` | Vercel-like density and clarity, with no effect on storefront styles. |
| Controls | Custom select, menu, popover, dialog, drawer/bottom sheet, toast, checkbox, switch, tabs, segmented control and calendar date picker | No browser-default selects, date pickers or drawers. A layer stack makes Escape close only the top-most layer. |
| Language | English UI; product and category copy edited in French and Arabic (RTL fields) | Matches the storefront's bilingual content model. |
| Payments | Cash on delivery only (unchanged). "Payments & refunds" = payment status on orders: delivered → paid, returned → refunded. Filters, export and cash-in-transit metrics. | Matches the backend scope. Online payments would add a provider. |

## 2. Architecture

```
src/app/(store)/…              storefront pages (moved, URLs unchanged) + layout with AppShell
src/app/admin/layout.tsx       admin root: fonts, theme script, toast/confirm providers
src/app/admin/login/           sign-in page (outside the session gate)
src/app/admin/(console)/       session gate + shell; one thin page per module
src/admin/
  lib/client.ts                adminApi (refresh + login redirect), useApi cache, invalidate, withQuery
  lib/format.ts, meta.ts       formatting (DZD, dates, wilayas) and status vocabularies
  lib/types.ts                 response types of the admin endpoints
  ui/                          primitives (core, overlay, floating, charts, date-picker)
  data/                        DataTable, Pagination, SelectionBar, Toolbar, SearchBox, FilterSelect, SavedViews, URL state
  shell/                       session gate + permissions, sidebar/top bar, ⌘K palette, theme, nav
  views/                       one file per module
```

**Request flow:** view → `useApi("/admin/…")` → `adminApi` → route handler (`route()`: CSRF, auth, RBAC, zod) → service (transaction + audit) → JSON. Mutations call `invalidate(prefix…)`, and every mounted query under those prefixes refetches.

## 3. Modules

| Module | Features |
|---|---|
| **Overview** | KPIs with period-over-period change (gross sales, orders, AOV, new customers) and sparklines; 7d/30d/90d/12m range; daily sales chart with keyboard-accessible tooltip; orders by status (links to filtered lists); "needs attention" (to fulfil, cash in transit, low stock); top products, regions, categories; recent orders; team activity (`audit:read` only); low-stock list. |
| **Orders** | Status tabs (multi-status), search (number, name, phone, email, tracking), payment, date and region filters, sort, pagination, column visibility, saved views, multi-select with shift-range, bulk status change with per-order results, CSV export (filter or selection), j/k/Enter navigation. Detail: items with SKU, totals, inline delivery fee, status actions from the server's allowed transitions, ship dialog (carrier + tracking), delivery panel with tracking link, internal note, timeline with actors and notes, customer/account link. A concurrent change shows a clear "changed in the meantime" message. |
| **Shipping** | Fulfilment board (to confirm → to pack → to ship → in transit) with one-click advance; carriers CRUD (tracking URL template, phone, note, active, position) with in-transit, delivered and return-rate stats. |
| **Customers** | Filters (status, email verified), sort (spend, orders, name, joined, last sign-in), profile with lifetime stats, orders, addresses, reviews, account history, sign-out-everywhere, disable/enable, role change (admins only, type-to-confirm for admin). |
| **Promotions** | Lifecycle state (active, scheduled, paused, expired, used up) with tab counts, sales, discount given, inline on/off, editor drawer (percent/fixed, cap, minimum, calendar dates, total and per-customer limits, live preview), redemptions drawer, delete only when unused. |
| **Products** | Tabs by status, category, stock and tag filters, SKU search, sort (name, price, stock, rating, updated), bulk publish/draft/feature/new/best-seller/move category/archive, archive with Undo, duplicate. Editor: details, FR/AR content (specs, in-the-box), variants (labels FR/AR, SKU, code, price, compare-at, initial stock, active, reorder), stock adjust per variant, images (multi-upload, drag & drop, reorder, delete), status, category, merchandising, Ctrl+S, unsaved-changes guard, **optimistic concurrency** (stale banner + reload). |
| **Inventory** | Summary (units, retail value, low, out), per-variant list with 30-day sales and days of cover, inline quantity editing saved as one all-or-nothing batch with reason and note, adjust dialog (add/remove/set), movement ledger with reason filter and order links. |
| **Categories** | All categories, including hidden ones, with product counts; drawer editor (FR/AR, slug, parent, position, image, visibility); delete only when empty. |
| **Reviews** | Published/hidden tabs with counts, rating filter, search, bulk publish/hide (ratings recomputed), detail drawer. |
| **Subscribers** | Newsletter list, status filter, CSV export of active subscribers. |
| **Team & roles** | Staff/admin list, add a team member by account email, role changes, read-only permission matrix from the server. |
| **Audit log** | Search, target type and period filters, actor and IP, before/after JSON, links to the target. |
| **Settings** | Display name, password change, theme (light/dark/system). Admins also get system status, read-only configuration, guest-cart cleanup (dry run + confirm) and expired rate-limit cleanup. |
| **Shell** | Sidebar (desktop) or drawer (tablet/phone), ⌘K palette (navigation, actions, live search across orders, products and customers), `g`+key shortcuts, `?` help, `/` search, skip link, admin 404. |

## 4. Backend extensions

All additive; storefront endpoints unchanged. New migration: `drizzle/0002_carriers.sql`.

| Area | Added |
|---|---|
| RBAC | `settings:manage` (admin only); `isStaffRole`, `roleMatrix()` |
| Identity | `GET admin/me`, `GET admin/roles` |
| Analytics | `GET admin/analytics?days=7\|30\|90\|365`: KPIs vs previous period, zero-filled daily series (Algeria time), top products, regions, categories, low stock, status counts, recent orders, cash in transit. The activity feed is only included with `audit:read`. |
| Products | List: `stock`, `flag`, `sort`, `dir`, thumbnails, stock totals, low-variant counts. `POST admin/products/bulk`. `PATCH admin/products/{id}` accepts `expectedUpdatedAt` (409 `stale`). Product detail returns labels for inactive variants too. |
| Inventory | `GET admin/inventory` (summary, 30-day sales), `GET admin/inventory/movements`, `POST admin/inventory/bulk` (atomic, rows locked in order) |
| Categories | `GET admin/categories` returns all with translations and counts; `DELETE admin/categories/{slug}` (empty only) |
| Orders | Multi-status, payment, region, carrier, customer and sort filters; tracking search; `POST admin/orders/bulk-status` (per-order results); `GET admin/orders/export` (CSV, formula-injection safe); detail includes actor names, SKUs and account |
| Customers | Status, verified, team scope and sort filters; full profile; `DELETE admin/customers/{id}/sessions` |
| Promotions | Performance stats; `GET`/`DELETE admin/promotions/{id}` (delete only if unused); a patch is validated against the merged record |
| Reviews | `GET admin/reviews` (filters, counts), `POST admin/reviews/bulk` |
| Audit | Action, search and date filters; actor name/email/role; total; entity types |
| Shipping | `carriers` table; `GET/POST admin/carriers`, `PATCH/DELETE admin/carriers/{id}` (http(s) URLs only) |
| Ops | `GET admin/newsletter`, `GET admin/newsletter/export`, `GET admin/system`, `POST admin/system/purge-carts` (dry run), `POST admin/system/rate-limits` |

Bug fixed during the work: correlated subqueries referenced the outer table unqualified, so they bound to the inner table (category product counts were 0, and customer order counts were affected the same way). These references are now table-qualified, and tests assert real counts.

## 5. Security notes

- Every admin endpoint is permission-checked server-side; the UI gating is cosmetic.
- Cookie auth with CSRF Origin checks applies to every console mutation (tested with a forged Origin).
- Login only accepts a same-site `/admin/*` `next` path (tested with an absolute URL). Customer accounts are signed out immediately after a console login attempt.
- Role changes, disabling an account and session revocation bump `token_version`, so access tokens die at once.
- Self-demotion and self-disable are refused; staff can't act on admins; promoting to admin requires typing the email.
- Analytics no longer leaks audit data to roles without `audit:read`.
- CSV exports neutralize spreadsheet formulas; carrier tracking URLs must be http(s).

## 6. Tests

| Suite | Scope |
|---|---|
| `tests/admin-api.test.ts` (Vitest, 15) | New endpoints against PGlite: RBAC, analytics, sort/filter, bulk, optimistic concurrency, atomic stock batch, category/promo delete rules, bulk transitions, CSV, session revocation, review moderation, carriers, system tools |
| `e2e/*.spec.ts` (Playwright) | Real production build, real API, a freshly seeded dedicated DB (`.data/e2e`, built by `scripts/e2e-seed.ts` through the real services: carts → checkout → transitions, then back-dated). Specs: `auth` (login, redirects, expiry/refresh, revocation, RBAC for staff/customer, CSRF), `orders` (pagination, tabs, search, sort, filters, columns, saved views, keyboard, CSV, full lifecycle, cancel → ledger, fee/note persistence, concurrent update, bulk with failures, shift-range), `catalog` (product create/validation/server conflicts, edit, Ctrl+S, discard, optimistic concurrency across users, image upload/reorder/delete, malicious upload, bulk + undo, inventory batch/ledger/adjust, categories), `people-marketing` (customers, disable/enable, self-protection, team grant/revoke, type-to-confirm, permission matrix, promotions incl. storefront refusal of a paused code, reviews, shipping board, carriers, audit, system tools, password change, profile, subscribers export), `ux` (accessible names on every page, no native selects/date inputs, focus trap/restore, nested-layer Escape, scroll lock, keyboard select, ⌘K, shortcuts, dark theme without flash, CLS < 0.1, admin 404, storefront unaffected), `responsive` (12 viewports incl. both sides of 640/768/1024/1280: no horizontal overflow, nav mode, table vs card list, header never covers content; mobile drawer, tappable cards, menus inside the screen, bottom sheets, scrollable wide tables). Every test fails on any page error or console error. |

Commands:

```bash
npm test                              # Vitest (API)
npm run test:e2e                      # seed + build (.next-e2e) + Playwright, port 3200
E2E_SKIP_BUILD=1 npm run test:e2e     # reuse the last E2E build
npm run e2e:seed                      # (re)create the demo/E2E database only
```

The E2E server uses system Chrome (`E2E_BROWSER_CHANNEL` overrides it), `LOCAL_PREVIEW=1`, rate limits off and a 1-hour access token. It never touches `.data/pglite` or `.next`.

## 7. Integration status

| Area | Status |
|---|---|
| All modules in §3 | ✅ wired to real endpoints, no mock data |
| Loading / empty / error / validation / success states | ✅ skeletons, empty states with actions, retryable errors, field errors (client and server), toasts |
| Storefront | ✅ unchanged behaviour (routes moved into `(store)`; 404 still shows the store chrome) |

## 8. Results

Final run, 2026-11-24:

| Check | Result |
|---|---|
| Vitest (`npm test`) | ✅ 82/82: 67 existing + 15 new admin API tests |
| Playwright (`npm run test:e2e`) | ✅ 91/91: 3 setup, 73 desktop, 15 responsive; 3.9 min with the build reused |
| `tsc --noEmit` | ✅ clean |
| ESLint | ✅ 0 errors (21 style warnings) |

Bugs the E2E suite found and that are now fixed (with regression coverage):
- Clicking a row's menu item (Archive, Delete…) also opened the row. React bubbles portal events through the component tree, so the table now ignores clicks from outside the row's DOM.
- Some form labels weren't associated with their controls (e.g. "Note" in status dialogs). `Field` now provides an id to every input, textarea, select and date picker inside it.
- Cards in grids could overflow the viewport on phones (grid items default to `min-width: auto`).
- Toggle switches in tables had no accessible name.
- The product editor's "Reload latest" could fail to replace the stale form.
- Analytics exposed audit activity to roles without `audit:read`.
- Correlated subqueries bound to the wrong table (see §4).

## 9. Remaining issues / next steps

1. **Carrier APIs** (Yalidine, ZR Express) are still manual: carrier + tracking number only. No label printing or webhooks.
2. **Online payments/refunds** don't exist (COD only). Refund = return flow. No partial refunds or partial returns of single lines.
3. **Admin MFA** is still not implemented (also listed in the backend plan). Recommended before adding more staff.
4. **Saved views and column choices** are stored per device (localStorage), not per user on the server.
5. **Product deletion** is archive-only by design; variants can be deactivated, not deleted.
6. **E2E runs serially** on one PGlite database (single connection). For CI, point `DATABASE_URL` at a throwaway Postgres to run workers in parallel.
7. **Category images** are a path field; there's no category image upload endpoint yet.
