# Hanutek — style lock

Redesign of `hanutek-hermess` (Next 16 / React 19 / Tailwind 4 / motion / lucide).
Automotive gadgets & accessories for the **Algerian (DZ) market**. Bilingual **FR / AR only**, RTL for Arabic, prices in **DZD**.

## Mood
Technical / builder-facing crossed with premium-confident. Motorsport-garage identity: precise,
road-tested, a little electric. NOT corporate blue, NOT generic SaaS. The only external reference
used is the product card from `hanutek-app` (anatomy + motion), adapted and improved.

## Color contract (all verified with check_contrast.py, WCAG AA)
| Role | Hex | Notes |
|---|---|---|
| ink / foreground | `#141814` | green-black text · 16.7:1 on bg |
| background | `#f7f7f3` | warm paper |
| surface / card | `#ffffff` | cards, sheets |
| muted | `#5b625b` | secondary text · 5.85:1 |
| faint | `#9aa09a` | decorative / disabled only |
| line | `#e6e6df` | hairline borders |
| accent (brand) | `#1b5e3a` | racing green · white label 7.75:1 · 7.2:1 visibility on bg |
| accent-ink | `#14532d` | green text on light · 8.48:1 |
| accent-soft | `#e8f1ea` | green tint fill (accent-ink text 7.9:1) |
| volt | `#d4ec24` | electric accent · FILL ONLY with ink text (13.5:1). Never volt text on light bg. |
| volt-soft | `#f4f9d6` | volt tint (ink text 16.5:1) |
| sale | `#c93a3a` | promo fill · white label 5.06:1 |
| sale-ink | `#a82323` | sale text on light (6.1:1 on sale-soft) |
| sale-soft | `#fbe9e7` | savings chip bg |
| success | `#157a43` | 5.39:1 on white |
| success-soft | `#e6f4ec` | success tint |

Blue is banned. The old `--accent:#112870` is replaced by racing green; every `accent*` utility
recolors automatically. Volt is the energy pop (badges, added-state, spotlight), used sparingly.

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
- Shadows: soft green-neutral `shadow-card` / `shadow-lift` / `shadow-pop` (no harsh drop shadows).
- Easing: `ease-out-quint` cubic-bezier(0.22,1,0.36,1). Hover lift −2px + image scale 1.04 (motion-safe).
- Page transitions: React `<ViewTransition>` + `transitionTypes` nav-forward/back (already scaffolded),
  shared product-image morph `.product-morph`. Reduced-motion respected globally.

## Density & spacing
4px base. App-shell chrome compact (12–16px). Content cards ≥24px internal. Marketing sections
64–128px desktop, stepped down on mobile. Internal ≤ external spacing always.

## i18n
Client `LocaleProvider` (fits the existing client store architecture; no route restructure).
`fr` default, `ar` RTL. `useI18n()` → `{locale, dir, setLocale, t, price, date, isRTL}`.
DZD via `Intl.NumberFormat('fr-DZ'|'ar-DZ', {currency:'DZD', maximumFractionDigits:0, numberingSystem:'latn'})`.
Prices repriced to realistic DZD; free-shipping threshold 8 000 DA, flat shipping 600 DA, promo DRIVE10 −10%.

## States
Every list/view ships loading, empty, error and success states. Focus-visible rings, aria labels,
44px touch targets, `aria-pressed` on toggles. No dead buttons.