# Barrio Burger Co. — design system

The website should feel like the flyers grew up: more polished, more responsive,
more alive, and still clearly made by a person. The rule is **controlled
imperfection**. Underneath sit a strict grid, a strict type scale and strict
spacing tokens. On top sit handmade treatments that are designed and repeatable,
never random.

- Tokens: `design/tokens.json`, implemented in `app/globals.css` (the Tailwind v4
  `@theme` block *is* the Tailwind theme configuration).
- Live component states: **`/styleguide`** (noindex).
- SVG marks: `components/ui/Doodles.tsx`, also exported to `public/brand/*.svg`
  by `pnpm tsx scripts/export-doodles.ts`.

---

## 1. Flyer analysis — PENDING

> **The printed flyers haven't been supplied yet.** The palette and type below
> are provisional and come from the written brief: Michoacán heritage, Mexican
> street murals, graffiti; framed panels, bold black outlines, flat color, no
> gradients. Put photos or scans of the flyers in `design/flyers/`. Then fill in
> this section and re-derive the tokens. Only the values change. The method and
> the component rules stay the same.

When the flyers arrive, record:

| Aspect | What to capture | Finding |
|---|---|---|
| Palette | Every ink / paper color, sampled to hex. Which one is the "loud" one? | _tbd_ |
| Lettering | Hand-lettered or a typeface? Weight, width, stacking, all caps? Outlines? | _tbd_ |
| Type mixing | How many styles per flyer; how size steps between them | _tbd_ |
| Layout | Centered vs. left; crowded vs. airy; what overlaps; what tilts and by how much | _tbd_ |
| Decoration | Borders, stars, arrows, underlines, stickers, tape, textures | _tbd_ |
| Spanish / English | Which words go in Spanish (headlines? jokes? prices never?) | _tbd_ |

Then update the color tokens and fonts, run the contrast table in §3 again, and
check every page against the two tests in §9.

## 2. Provisional direction

| Token | Hex | Role |
|---|---|---|
| comal (dark bg) | `#1F1915` | Warm near-black, so the black outlines still read at night |
| papel | `#F7EFE2` | Flyer-paper cards with black ink |
| rojo chile | `#E5432C` | Primary action, the hero panel |
| cempasúchil | `#FFB627` | Highlights, stickers, links on dark |
| rosa mexicano | `#FF5FA8` | Stickers, underlines |
| agave | `#3DBE6B` | OPEN |
| añil | `#2D5BD7` | Info panels (late-night note) |
| outline | `#0B0907` | Every border and hard shadow |

**Type.** All three faces are free web fonts from Google Fonts.

| Face | Use | License |
|---|---|---|
| **Bowlby One** | Fat poster display, uppercase, headlines only | SIL OFL 1.1 |
| **Atkinson Hyperlegible Next** | Body. Built for legibility, which matters outdoors at night. Used for menus, prices, forms and legal text | SIL OFL 1.1 |
| **Permanent Marker** | Hand annotations and Spanish kickers. Use sparingly | Apache 2.0 |

The type scale is fluid (`clamp`), from 320 px phones to 1440 px+ desktops. Body
text is 17 px.

## 3. Contrast (WCAG AA)

Every text/background pair used is at least 4.5:1:

| Pair | Ratio |
|---|---|
| Dark text `#F7EFE2` on bg | 15.2 |
| Muted text `#C9BCA8` on bg | 9.3 |
| Muted text `#C9BCA8` on surface | 8.3 |
| Ink `#14110E` on chile | 4.6 |
| Ink on marigold | 10.7 |
| Ink on agave | 7.9 |
| White on añil | 5.9 |
| Light theme: ink on papel | 16.5 |
| Light theme: muted on papel | 6.6 |
| Light theme: success | 4.7 |
| Light theme: danger | 5.7 |

The `.paper` utility swaps the semantic text tokens to dark ink, so any
component placed on paper stays legible.

## 4. The handmade treatments (rules)

| Treatment | Rule | Utility / component |
|---|---|---|
| **Outlines** | 3 px black on cards and panels, 2 px on small things (stickers, inputs, chips), 4 px on hero-scale elements. Never grey. | `panel`, `paper`, `border-[length:var(--line)] border-outline` |
| **Hard shadows** | Solid, zero blur, down-right: 3 / 5 / 8 px. Never soft drop shadows. | `shadow-hard-sm`, `shadow-hard`, `shadow-hard-lg` |
| **Tilts** | Only the five fixed angles `tilt-a…e` (−2°, 1.5°, −1°, 2.5°, −3°). Assigned per component and per position (see the tilt map). Never `Math.random()`. Text blocks longer than ~3 lines stay within ±1.5°. | `tilt-a` … `tilt-e` |
| **Press** | Buttons and tappable tiles sink into their shadow on `:active`: translate by the small offset, shadow goes to 0. | `press` |
| **Straighten** | Stickers rotate to 0° on hover or focus (hover-capable devices only). | `straighten` (built into `Sticker`) |
| **Stickers** | Flat fill, 2 px outline, small shadow, display face, uppercase. Spanish where comprehension isn't critical (¡NUEVO!, MUY PRONTO). Status stickers always pair a word with an icon. | `<Sticker>` |
| **Tape** | One strip across the top edge of paper cards (specials, coming-soon). At most one taped card per row of three. | `taped` |
| **Hand-drawn marks** | Underline under section headings (draws itself in once); circle around one price per section at most; arrows only to point at an action; stars and bursts carry prices. | `Doodles.tsx`, `draw` |
| **Paper grain** | One inline SVG noise tile at 5% opacity, fixed, `pointer-events: none`. No image request. | `body::before` |
| **Graffiti accents** | Permanent Marker kickers above headings and the odd annotation. At most one per section. | `SectionHeading kicker` |

### Tilt map (fixed assignments)

- Hero logo card: `d`. Hero Spanish kicker: `c`.
- Quick-link tiles: `a`, `b`, `c`, left to right.
- Special cards: `a`, `d`, `c` by index; their kicker sticker: `e`.
- Menu cards (≥ 640 px only; phones get straight compact rows): `c`, `b`, none, `a` by index.
- Footer slogan: `c`. Find-us hours card: `b`. Back-soon note: `c`.
- Stickers default to `a`; the status sticker in the hero uses `b`.

### Fixed vs per-component

- **Fixed globally:** colors, fonts, type scale, outline widths, shadow offsets,
  the five tilt angles, motion durations and easing, the 44 px minimum touch target.
- **Chosen per component:** which tilt (from the map), which mural fill, whether
  a card is `paper` (flyer) or `panel` (dark), and which doodle accompanies a
  heading.

## 5. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-press` | 90 ms | Button sink |
| `--dur-fast` | 160 ms | Color and hover changes; page view transition |
| `--dur-base` | 240 ms | Sticker straighten, dialogs rising in |
| `--dur-draw` | 650 ms | Underline draw-in, once |
| Open pulse | 2.4 s, loops while open | Only the OPEN dot pulses, and only that dot |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | |
| `--ease-pop` | `cubic-bezier(.34,1.56,.64,1)` | |

Page transitions are client-side navigations with sections rising in (`rise-in`,
240 ms). Cross-document View Transitions were tried and removed: they stalled
rendering after full-page redirects (such as the return from Stripe Checkout)
in headless Chrome.

**Reduced motion:** under `prefers-reduced-motion: reduce`, every animation and
transition drops to about 0 ms. Underlines render already drawn, the pulse
stops. Nothing conveys information by motion alone.

## 6. Components

All interactive states are on `/styleguide`. They're listed here per component:

| Component | States covered |
|---|---|
| Button / LinkButton | Variants primary, marigold, agave, paper, danger, ghost; sizes sm, md, lg. States: hover, `:active` press, focus-visible ring, disabled (55% opacity, not-allowed), loading (spinner + `aria-busy`). |
| StatusBanner + StatusIcon | Open (pulsing dot), Back soon (clock), Closed (×). Always word + icon + color. |
| Sticker | Tones: marigold, rosa, agave, chile, paper, añil. Sizes sm, md, lg. |
| Menu item card | Phone: compact row. ≥ 640 px: tilted card. Sold out: grayscale photo, struck price and a "Sold out · Agotado" sticker. NEW sticker. Price "from" when there are several sizes. |
| Form fields | `TextField`, `TextArea`, `SelectField`, `Checkbox` (never pre-checked for consent), `FieldError` (✕ icon + text, `aria-describedby`), `FormNotice` (error and success), `Honeypot`. |
| Navigation | Desktop: inline links. Mobile: full-height sheet (`<dialog>`, Esc and backdrop close). |
| Sticky bottom bar | Menu · **Order** · Find us. Phones only; hidden inside order and checkout flows. |
| Section dividers | `ZigzagDivider`, `SectionHeading` with the drawn underline. |
| Footer | Logo slot, location, nav, Instagram, theme switch, legal. |

The cart drawer, gallery tile, product cards and order tracker are built by
their features under `components/order`, `components/gallery` and
`components/merch`, with the same rules applied.

## 7. Logo

The owner is hand-drawing the final logo. `LogoSlot` renders a clearly labelled
dashed placeholder everywhere the logo goes (header, hero, footer, story, QR
cards). To install the logo, put `public/brand/logo.svg` in place and set
`NEXT_PUBLIC_LOGO_READY=1`. **Do not design or generate a logo.**

Photos follow the same idea. `PhotoSlot` is a flat colour block with a
hand-lettered label ("foto: …") until real photography replaces it. No stock
photos and no AI imagery.

## 8. Implementation guide (for engineers)

1. **Start from the utilities**, not ad-hoc styles. Use `panel` or `paper` for
   any framed block, plus a `shadow-hard-*` size, `press` if it's tappable, and a
   tilt from the map.
2. **Tilts are props or literal classes.** Tailwind only generates class names it
   can see in the source, so use literal arrays like `['tilt-a','tilt-d']`. Never
   build `` `tilt-${x}` `` and never randomise.
3. **Text on color uses the paired `on-*` token** (`bg-chile text-on-chile`).
   Text never wears the decoration color unless the pair is listed in §3.
4. **Spanish is decorative.** It goes in kickers, stickers and taglines. Order
   steps, prices, form labels, consent text and legal copy stay in plain English.
5. **Performance.**
   - Fonts are `next/font`, self-hosted and swapped in.
   - The grain is one inline SVG.
   - Doodles are inline SVG with no requests.
   - The map iframe is `loading="lazy"`.
   - YouTube loads only on tap. Instagram's embed script loads only when the
     gallery's Instagram section comes near the screen.
   - Images use `next/image` with `sizes`.
   - No animation runs layout properties, only transform, opacity and box-shadow.
6. **Accessibility.**
   - Every page has one `h1` and a skip link.
   - Focus is always visible (3 px ring).
   - Touch targets are 44 px minimum, 48 px for primary actions.
   - Status is never color alone.
   - Dialogs use `<dialog>`.
   - Forms have visible labels, inline errors tied with `aria-describedby`, and
     `role="alert"` on summaries.
   - Live status regions use `aria-live="polite"`.
   - Forced-colors mode keeps outlines.
7. **Dark is the default.** The footer switch sets a `theme` cookie that the
   server reads, so there's no flash. Both themes must pass §3.
8. **The admin is utilitarian.** It uses the same tokens with no tilts, doodles
   or grain-heavy panels; see `components/admin/ui.tsx`.

## 9. Review tests (run on every page before shipping)

1. **Would a customer believe a person made this, consistent with the flyers?**
   - Pass when it uses framed panels, black outlines, flat fills, a fixed tilt
     or two, a hand mark, and Spanish kickers.
   - Fail when you see gradients, soft shadows, stock photos, or perfectly
     uniform card grids with no character.
2. **Can someone at 2 AM, outside, on a phone, check whether we're open and
   place an order in under a minute?**
   - The status banner is the first thing on every page, and the order button
     sits in the thumb bar.
   - The order flow is: menu → item sheet → cart bar → checkout (name, phone,
     card) → code.
   - Big type, 17 px body, at least 4.5:1 contrast, and nothing loads that
     isn't needed.
