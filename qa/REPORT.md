# View-transitions QA — three animations (rebuilt from references)

Run: 2026-11-18 against `next start -p 3111` (production build, current working tree).
Harness: `qa/capture.mjs` (fast captures + state facts), `qa/slowmo.mjs` (test-only
`animation-duration:4s` override so screencast samples land mid-flight).
Each case: fresh context, locale via `hanutek-locale` localStorage, zero console/page errors
unless stated.

## ANIMATION 1 — shared image morph (home rails + favorites ⇄ detail hero)

| Case | Result |
|---|---|
| fr1440_a1_rail2detail / fr390_a1_rail2detail | card → detail, heroImg ✓ |
| fr1440_a1_detail2home | breadcrumb morph back, home ✓ |
| sm_fr_rail (slow-mo) | **true mid-flight frame**: detail layer ghost-blended over the shared image mid-resize — morph caught in flight (see `evidence_sheet.png` bottom-right, vision-verified) |

Mechanism: `<ViewTransition name="product-img-{slug}" share={{morph:"morph",default:"none"}}>`
on card image + detail hero; morph links carry `["morph","nav-forward"]` (push fires with it);
listing/cart/sheet links never claim the type ⇒ plain push, per spec. 400ms group + via-blur 3px.

## ANIMATION 2 — cinematic push (exact ecommerce-transition-demo.html values)

| Case | Result |
|---|---|
| fr1440_a2_home2products, fr834_a2_home2products | push ✓ |
| sm_fr_tabs (slow-mo) | **mid-flight double-exposure frame** with horizontal offset + opacity blend (evidence_sheet top-left, vision-verified) |
| fr1440_a2_back (hardware Back) | `data-nav="nav-back"` stamped during pop ✓; consecutive frame-diff decay 0.35→0.13 over ~6 frames = continuous 440ms animation ✓ |
| ar1440_a2_home2products, ar390_a2_back | RTL: mid-flight state assertions `--vt-old: vt-push-out-back` / `--vt-new: vt-push-in-back` on AR click (mirrored) and `out-fwd/in-fwd` on AR pop ✓ |

Values (globals.css keyframes, verbatim from the HTML demo): old → `translateX(∓58px)
scale(.975) blur(1.5px) opacity .42`; new from `translateX(±90px) scale(.965) blur(2px)
opacity 0`; `440ms cubic-bezier(.22,1,.36,1)`.

Mechanism note (why not the reference's class map): React 19.3 creates **no snapshot group** for
nameless boundaries (classes attach to nothing; a named page-boundary snapshots but renders blank
under the App Router), and Next 16 starts a view transition only for typed navigations. The push is
therefore driven on the root pair via `--vt-old/--vt-new` custom-property stamps (web.dev
conditional-VT pattern) written by the early inline script in `app/layout.tsx` (link clicks +
pops with a manual `startViewTransition`) and `stampNav()` for JS pushes (buy-now, search, submit).
RTL flip happens at stamp time. Screenshot-based in-flight capture of the UA VT overlay is
unreliable via CDP in headless Chrome (hold frames read blank/settled) — RTL/back are proven at
state level + identical render path as the visually-confirmed FR frames.

## ANIMATION 3 — checkout auto-scroll (the ★)

| Case | Result |
|---|---|
| fr1440_a3_cartscroll | `#checkout` form mounted **before** click ✓, CTA click → scroll 0→658 ✓, URL stays `/cart` ✓, `__noReload` marker = 1 (same document) ✓ |
| ar1440_a3_cartscroll | same ✓ (0→641) |
| fr390_a3_sheetscroll / fr834_a3_sheetscroll | sheet mounted ✓, in-sheet container scroll 0→286 ✓, no route change ✓ |
| ar390_a3_sheetscroll | ✓ (0→286) |
| deep link `/checkout` | lands `/cart`, auto-scrolls to form (y≈658), hash cleaned ✓ |
| order submit (desktop + sheet) | validates, places, pushes `/order/HT-…`, sheet self-closes ✓ |
| `fr390_a3_sheetscroll_after.png` | vision-verified: sheet chrome intact (Retour/Panier/×), lines scrolled out, form + totals below — no reload, no top-entry, no white flash |

`/checkout` page = redirect to `/cart#checkout` only; the form component lives inline in the cart
page AND the expanded sheet, always rendered, zero entrance animation.

## Reduced motion

| Case | Result |
|---|---|
| fr390_reduced_a1 | client nav to detail: hero pixel sample [122,120,124] (painted, no stuck white snapshot) ✓ |
| ar1440_reduced_a2 | instant swap, grid present ✓ |

Boundaries are JS-gated (no ViewTransition rendered), inline pop script bails on the media query,
CSS durations zeroed as belt-and-braces.

## Files

`*.mp4` clips per case, `*_after.png` settled shots, `frame_*/` raw in-flight frames,
`evidence_sheet.png` labeled 2×2, `results.json` full facts.
