# Hanutek — style lock

Redesign of `hanutek-hermess` (Next 16 / React 19 / Tailwind 4 / motion / lucide).
Automotive gadgets & accessories for the **Algerian (DZ) market**. Bilingual **FR / AR only**, RTL for Arabic, prices in **DZD**.

## Mood
Technical / builder-facing crossed with premium-confident. Motorsport-garage identity: precise,
road-tested, a little electric. **Ink + Volt** — near-black ink on **plain white** with an electric volt
pop. NOT corporate blue, NOT green, NOT generic SaaS. The only external reference used is the
product card from `hanutek-app` (anatomy + motion), adapted and improved.

## Color contract (Ink + Volt · verified WCAG AA on white)
| Role | Hex | Notes |
|---|---|---|
| ink / foreground | `#141814` | green-black text · 17.94:1 on white |
| background / surface | `#ffffff` | **plain white** (user-mandated; cards separate via `line` border) |
| muted | `#565c56` | secondary text · 6.86:1 (darkened for white) |
| faint | `#61675f` | captions, hints, struck prices · 5.81:1 |
| line | `#e4e4de` | hairline borders |
| accent (brand) | `#171a17` | ink near-black · white label 17.55:1 |
| accent-ink | `#2a2e2a` | ink text on light · 12.84:1 |
| accent-soft | `#f0f0ea` | warm ink tint fill (slightly darkened so tints read on white) |
| volt | `#d4ec24` | electric accent · FILL ONLY with ink text (13.52:1). Never volt text on light bg. |
| volt-soft | `#f4f9d6` | volt tint (ink text high-contrast) |
| sale | `#c93a3a` | promo fill · white label 5.06:1 |
| sale-ink | `#a82323` | sale text on light |
| sale-soft | `#fbe9e7` | savings chip bg |
| success | `#2a2e2a` | ink positive text (no green) |
| success-soft | `#f4f9d6` | pale-volt positive tint |

Blue **and** green are banned. `--accent` is ink `#171a17` (Ink + Volt); every `accent*` utility
recolors automatically. Volt is the energy pop (badges, spotlight, dark-surface text), used sparingly.
The earlier racing-green direction (`#1b5e3a`) was rejected by the user and is fully retired.

**Contrast rules (audited):** `faint` is readable secondary text (AA) — never use `line` or low-alpha ink
for text. Volt text/accents live on **dark** surfaces only (13.5:1); on light surfaces use ink. Dark
surfaces (video hero, spotlight, footer) must use `text-background/*` — never light-theme `text-muted`/
`text-foreground`.

## Typography
- Latin display / headings / brand / prices: **Space Grotesk** (500/600/700), tight tracking on Latin display only.
- Latin body / UI: **Inter** (400/500/600).
- Arabic (all roles, one family per non-Latin model): **IBM Plex Sans Arabic** (400/500/600/700).
  Loaded as a fallback in the sans/display stacks so Arabic glyphs resolve automatically.
- Mono voice (eyebrows, spec values, order IDs): **Space Mono** (400/700).
- Arabic rules: `letter-spacing:0` (never negative tracking), comfortable line-height, prices/numerals
  stay `dir="ltr"` with tabular-nums even inside RTL.

## Shape, depth, motion
- Radius scale: control 10px · card 14px · sheet 20px · pills full · hero banner 24px.
- Shadows: soft ink-neutral `shadow-card` / `shadow-lift` / `shadow-pop` (no harsh drop shadows).
- Easing: `ease-out-quint` cubic-bezier(0.22,1,0.36,1).
- **Motion is deliberately minimal** (user mandate): no page transitions, no shared-element morphs,
  no scroll-reveals, no text roll/shimmer/marquee/border-beam, no hover-scale gimmicks. What remains:
  ≤200ms color/border transitions on controls, the cart **Sheet** (modal spring), **toasts**, and the
  mouse-magnify inside the FloatingDock (the one motion the user explicitly requested).
- **No browser-default chrome anywhere**: custom `SelectMenu` listbox for sort + wilaya (no native
  dropdown), styled search input (webkit cancel hidden), custom checkboxes/radios via cards.

## Navigation architecture (current)
- **Header (all breakpoints):** logo left. No filter/category links in the navbar.
  Desktop (lg+): pill **search bar in the navbar** with a full suggestions dropdown (recent searches,
  popular chips, product rows with thumbnails + match highlight + price, category rows, see-all footer,
  keyboard nav). Right: favorites heart (md+), cart sheet button (md+), profile, locale toggle.
  Mobile/tablet (<lg): right side = search icon (expands a full-width bar + same suggestions panel
  inside the sticky header; closes on route change) and profile. No sidebar/menu drawer (removed).
- **Bottom dock (phones + tablets, `lg:hidden`):** Aceternity-style `FloatingDock` ported verbatim in
  styling from `Desktop/work/utils/components/floatingDock.tsx` (`bg-gray-50` pill, 40→80px mouse
  magnify springs, hover tooltips), items in order: **Accueil · Boutique · Panier (badge) · Favoris
  (badge) · Commandes (→ /profile?tab=orders)**. Active item = ink circle. `/favorites` is a public page.
- Announcement strip: static mono line `Code DRIVE10 = −10% · Paiement à la livraison` (no shine anim).

## Product surfaces
- **Home:** auto-playing **video hero banner** (rounded-24px card, one source per screen family:
  phone 2:1 · tablet 2:1 · desktop 16:9, `public/hero/web/*`, MP4 first + WebM fallback, poster,
  pause under prefers-reduced-motion, **no CTA, no nav dots**, left/bottom text overlay on a scrim).
  Sections = **scroll-snap carousels on mobile (`.product-rail`, ~72% wide cards)** → 3/4-col grids on md+.
- **All products & favorites:** shared `product-grid` — 2 columns on phones, edge-to-edge with a small
  gutter (~185px cards, user asked "wider"), same card sizing everywhere.
- Card anatomy: border+surface (no shadow stack), badges, heart toggle, rating, price/compareAt,
  one-tap Add-to-cart (volt added state).

## Commerce rules (user mandates)
- **Cash on delivery ONLY.** No card, no CCP/BaridiMob, no online payment anywhere.
- **No free-shipping messaging.** Flat 600 DA standard, 900 DA express. `SHIPPING_FLAT`, no threshold.
- **No returns/warranty/guarantee promises.** No "Pourquoi hanutek", no trust-bar sections.
- Product detail = ONE action block: quantity + "Ajouter au panier" (outline) / divider "ou" /
  "Commander maintenant · price" (primary) + hint line. No duplicate order buttons.
- Promo code lives in an explicit card on /cart (title + DRIVE10 chip + input + Appliquer).
- Prices in DZD via `Intl.NumberFormat('fr-DZ'|'ar-DZ', {currency:'DZD', maximumFractionDigits:0, numberingSystem:'latn'})`.
  Localized copy in `m.home`, `m.categories[slug]`, `m.products[slug]` — never hardcode FR/EN strings.

## Density & spacing
4px base. App-shell chrome compact (12–16px). Content cards ≥24px internal (16px on small phone cards).
Marketing sections 48–96px desktop, stepped down on mobile. Internal ≤ external spacing always.

## States
Every list/view ships loading, empty, error and success states. Focus-visible rings, aria labels,
44px touch targets, `aria-pressed` on toggles. No dead buttons. Mobile-native baseline in globals.css:
tap-highlight off, `touch-action: manipulation`, 16px inputs on coarse pointers, safe-area insets
(`viewport-fit=cover`), overscroll containment, `theme-color` per scheme.
