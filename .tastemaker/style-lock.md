# Hanutek — style lock

Redesign of `hanutek-hermess` (Next 16 / React 19 / Tailwind 4 / motion / lucide).
Automotive gadgets & accessories for the **Algerian (DZ) market**. Bilingual **FR / AR only**, RTL for Arabic, prices in **DZD**.

## Mood
Technical / builder-facing crossed with premium-confident. Motorsport-garage identity: precise,
road-tested, a little electric. **Ink + Volt** — near-black ink on warm paper with an electric volt
pop. NOT corporate blue, NOT green, NOT generic SaaS. The only external reference used is the
product card from `hanutek-app` (anatomy + motion), adapted and improved.

## Color contract (Ink + Volt · verified WCAG AA)
| Role | Hex | Notes |
|---|---|---|
| ink / foreground | `#141814` | green-black text · 16.71:1 on bg |
| background | `#f7f7f3` | warm paper |
| surface / card | `#ffffff` | cards, sheets |
| muted | `#5b625b` | secondary text · 5.85:1 |
| faint | `#646a64` | readable secondary text (counts, captions, hints, struck prices) · 5.16:1 bg / 5.54:1 white |
| line | `#e6e6df` | hairline borders |
| accent (brand) | `#171a17` | ink near-black · white label 17.55:1 · 16.34:1 on bg |
| accent-ink | `#2a2e2a` | ink text on light · 12.84:1 |
| accent-soft | `#ecece6` | warm ink tint fill (accent-ink text 11.63:1) |
| volt | `#d4ec24` | electric accent · FILL ONLY with ink text (13.52:1). Never volt text on light bg. |
| volt-soft | `#f4f9d6` | volt tint (ink text high-contrast) |
| sale | `#c93a3a` | promo fill · white label 5.06:1 |
| sale-ink | `#a82323` | sale text on light (on sale-soft) |
| sale-soft | `#fbe9e7` | savings chip bg |
| success | `#2a2e2a` | ink positive text (no green) |
| success-soft | `#f4f9d6` | pale-volt positive tint |

Blue **and** green are banned. `--accent` is ink `#171a17` (Ink + Volt); every `accent*` utility
recolors automatically. Volt is the energy pop (badges, added-state, spotlight), used sparingly.
The earlier racing-green direction (`#1b5e3a`) was rejected by the user and is fully retired.

**Contrast rules (audited):** `faint` is readable secondary text (AA) — never use `line` or low-alpha ink
for text. Volt text/accents live on **dark** surfaces only (13.5:1); on light surfaces use ink. Dark
surfaces (hero, spotlight, footer) must use `text-background/*` — never light-theme `text-muted`/
`text-foreground` (≈2.8:1, near-invisible there). Empty rating stars use `text-faint`, not `text-line`.
`BlurFade` skips blur/opacity under `prefers-reduced-motion` so content never rests invisible.

## Typography
- Latin display / headings / brand / prices: **Space Grotesk** (500/600/700), tight tracking on Latin display only.
- Latin body / UI: **Inter** (400/500/600).
- Arabic (all roles, one family per non-Latin model): **IBM Plex Sans Arabic** (400/500/600/700).
  Loaded as a fallback in the sans/display stacks so Arabic glyphs resolve automatically.
- Mono voice (eyebrows, spec values, order IDs): **Space Mono** (400/700).
- Arabic rules: `letter-spacing:0` (never negative tracking), comfortable line-height, prices/numerals
  stay `dir="ltr"` with tabular-nums even inside RTL.

## Shape, depth, motion
- Radius scale: control 10px · card 14px · sheet 20px · pills full. One scale, no arbitrary mixing.
- Shadows: soft ink-neutral `shadow-card` / `shadow-lift` / `shadow-pop` (no harsh drop shadows).
- Easing: `ease-out-quint` cubic-bezier(0.22,1,0.36,1). Hover lift −2px + image scale 1.04 (motion-safe).
- Page transitions: React `<ViewTransition>` + `transitionTypes` nav-forward/back (already scaffolded),
  shared product-image morph `.product-morph`. Reduced-motion respected globally.
- Navbar (restored classic): light `bg-surface` announcement bar + sticky paper header, ink wordmark,
  static `bg-surface` active nav pill; full-width 5-tab mobile bottom bar, `bg-accent-soft` + `text-accent-ink`
  active pill. In-place transitions only (no shared `layoutId` — it mis-projects under RTL).

## Density & spacing
4px base. App-shell chrome compact (12–16px). Content cards ≥24px internal. Marketing sections
64–128px desktop, stepped down on mobile. Internal ≤ external spacing always.

## i18n
Client `LocaleProvider` (fits the existing client store architecture; no route restructure).
`fr` default, `ar` RTL. `useI18n()` → `{locale, dir, setLocale, t, m, price, date, isRTL}`.
DZD via `Intl.NumberFormat('fr-DZ'|'ar-DZ', {currency:'DZD', maximumFractionDigits:0, numberingSystem:'latn'})`.
Prices repriced to realistic DZD; free-shipping threshold 8 000 DA, flat shipping 600 DA, promo DRIVE10 −10%.
Localized copy lives in `m.home`, `m.categories[slug]`, `m.products[slug]` — never hardcode FR/EN strings.

## States
Every list/view ships loading, empty, error and success states. Focus-visible rings, aria labels,
44px touch targets, `aria-pressed` on toggles. No dead buttons.
