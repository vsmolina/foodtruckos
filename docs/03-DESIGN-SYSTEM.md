# 03 — Design System

> For both humans and Claude Code. This document is a design brief and a spec. If a visual choice isn't covered here, the answer is: restraint, precision, typographic confidence. When in doubt, ask.

---

## Aesthetic direction

**"Restaurant operating-room."** Think: a Michelin-starred kitchen pass meets flight-deck instrumentation. Dense information when it matters (dashboard, KDS), generous white space when it doesn't (settings, menus). No glassmorphism. No purple gradients. No "modern SaaS startup" pastel look. No dark-theme-because-dark-is-cool.

We commit to one direction: **refined, editorial, high-contrast with a single warm accent.** Cream background (not pure white — pure white is harsh on the Pi display and in bright food-truck lighting), near-black text, one saturated accent color that earns its place by appearing only on actionable elements and critical states.

The kitchen display uses the same system but inverts the background to deep charcoal — readable across a greasy kitchen at arm's length.

This is a working tool. It should feel like it was designed by someone who respects the person using it during a dinner rush.

---

## Typography

**Display / headings:** [Fraunces](https://fonts.google.com/specimen/Fraunces) — a variable serif with optical size. Use `opsz 72+, wght 500, SOFT 50, WONK 1` for big moments. Its warmth balances the utilitarian layout.

**Body / UI:** [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) — 400/500/600. Slightly quirky, technical, doesn't scream "designer." Pairs with Fraunces without fighting it.

**Numerics / timers / prices:** [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — 500. Tabular figures, no ambiguous zero. Critical for the KDS timer. Always use with `font-variant-numeric: tabular-nums`.

**Banned:** Inter, Roboto, Arial, SF Pro, Helvetica Neue, system-ui as a display face, any "Space Grotesk / DM Sans / Satoshi" generic-modern-geometric sans. They've been used everywhere; they signal nothing.

### Type scale

| Token            | Size                      | Line height | Weight | Font                                            |
| ---------------- | ------------------------- | ----------- | ------ | ----------------------------------------------- |
| `--text-display` | clamp(2.25rem, 5vw, 4rem) | 1.05        | 500    | Fraunces                                        |
| `--text-h1`      | 2rem                      | 1.15        | 500    | Fraunces                                        |
| `--text-h2`      | 1.5rem                    | 1.2         | 500    | Fraunces                                        |
| `--text-h3`      | 1.125rem                  | 1.3         | 600    | IBM Plex Sans                                   |
| `--text-body`    | 0.9375rem (15px)          | 1.55        | 400    | IBM Plex Sans                                   |
| `--text-ui`      | 0.875rem (14px)           | 1.4         | 500    | IBM Plex Sans                                   |
| `--text-caption` | 0.75rem (12px)            | 1.3         | 500    | IBM Plex Sans, letter-spacing 0.02em, uppercase |
| `--text-mono`    | 0.875rem                  | 1.4         | 500    | JetBrains Mono                                  |
| `--text-timer`   | 1.75rem                   | 1           | 600    | JetBrains Mono, tabular-nums                    |

All headings use `text-wrap: balance`. All body copy uses `text-wrap: pretty`.

---

## Color

One palette, two themes (light for dashboard/admin, dark for KDS). Kitchen display always dark.

### Light theme (dashboard, admin, POS)

```css
--bg: #f6f1e8; /* warm cream, not white */
--bg-raised: #fbf7ef; /* cards, slightly lighter than bg */
--bg-sunken: #efe8da; /* wells, inputs, subtle inset */
--ink: #14110e; /* near-black, warm */
--ink-2: #3b352e; /* secondary text */
--ink-3: #7a6f62; /* muted text, icons */
--rule: #e0d6c4; /* hairline borders */
--accent: #c8441e; /* the one hot color — adobe / ember */
--accent-ink: #ffffff; /* text on accent */
--success: #2f6a3f; /* quieter than standard green */
--warn: #b5701a; /* amber */
--danger: #a12e1c; /* deeper red than accent */
```

### Dark theme (KDS only)

```css
--bg: #161310;
--bg-raised: #1f1c18;
--bg-sunken: #0f0d0b;
--ink: #f2eadc;
--ink-2: #beb4a3;
--ink-3: #7e7566;
--rule: #2a2520;
--accent: #e86a3e; /* slightly brighter for dark bg */
--accent-ink: #0f0d0b;
--success: #6ba778;
--warn: #e0a15a;
--danger: #d94f35;
```

### Rules

- `--accent` appears only on: primary action buttons, the active nav item, critical state indicators, focused form controls (via ring). **Never as a background for large areas.** Never as a gradient.
- States on KDS cards use `--ink` / `--warn` / `--danger` borders and subtle background tint (8% opacity max). Never fill the whole card in red.
- Success messages use `--success`, not green checkmarks plastered everywhere.
- Destructive actions get a two-step confirm, not just a red button.

---

## Spacing + radius

An 8-point grid with one fractional step for tight spots:

| Token       | Value |
| ----------- | ----- |
| `--space-0` | 2px   |
| `--space-1` | 4px   |
| `--space-2` | 8px   |
| `--space-3` | 12px  |
| `--space-4` | 16px  |
| `--space-5` | 24px  |
| `--space-6` | 32px  |
| `--space-7` | 48px  |
| `--space-8` | 64px  |
| `--space-9` | 96px  |

Radii are restrained. **No rounded-full on non-circular elements. No 24px radius on cards.**

| Token           | Value  | Use                       |
| --------------- | ------ | ------------------------- |
| `--radius-sm`   | 2px    | inputs, tags, small chips |
| `--radius`      | 4px    | buttons, cards, modals    |
| `--radius-lg`   | 8px    | large hero surfaces only  |
| `--radius-full` | 9999px | avatars, true pills       |

---

## Elevation

Shadows are near-invisible and serve hierarchy, not decoration.

```css
--shadow-1: 0 1px 0 0 rgba(20, 17, 14, 0.04), 0 1px 2px 0 rgba(20, 17, 14, 0.06);
--shadow-2: 0 2px 4px 0 rgba(20, 17, 14, 0.04), 0 4px 12px -2px rgba(20, 17, 14, 0.08);
--shadow-pop: 0 8px 24px -8px rgba(20, 17, 14, 0.14); /* modals, menus */
```

Never use `box-shadow: 0 0 0 3px rgba(purple, 0.5)` for focus rings. Use `outline: 2px solid var(--accent); outline-offset: 2px`.

---

## Motion

Animations exist for three reasons only: (1) state continuity (a card moving between columns), (2) attention (a new order arriving), (3) feedback (tap response). Everything else is off.

```css
--ease: cubic-bezier(0.32, 0.72, 0, 1); /* the Apple ease — crisp in, soft out */
--ease-spring: cubic-bezier(0.5, 1.6, 0.4, 1); /* for arrivals */
--dur-1: 120ms; /* micro — button press */
--dur-2: 200ms; /* default — hovers, menus */
--dur-3: 360ms; /* state transitions */
--dur-4: 560ms; /* arrivals, celebratory */
```

- **New KDS order card** enters with a short `scale(0.96)` + `translateY(8px)` + opacity 0 → rest, over `--dur-4` on `--ease-spring`. Keep it under 600ms; cooks shouldn't wait to read it.
- **Completed card** exits with a quick fade + `scale(0.98)` over `--dur-3`.
- **No parallax. No spring-physics everywhere. No page transition flourishes.** This is a kitchen tool, not a portfolio.

Respect `prefers-reduced-motion`. All motion should degrade to 0ms duration when it's set.

---

## Layouts

### Dashboard

- Max content width **1280px**, centered, with `--space-7` horizontal gutter.
- Two-column hairline divider layout for dense pages: sidebar nav 240px, content fluid.
- KPI tiles use a **12-column CSS grid** with tiles spanning 3/4/6 cols depending on weight.
- Tables are prose-dense: no zebra striping; hairlines between rows in `--rule`; first column gets slightly more weight. Row hover reveals actions on the right edge, no permanent action column cluttering width.
- Never use cards-with-shadows to denote hierarchy. Use typography weight, color contrast, and a single 1px rule.

### KDS (most important — this is where Victor lives)

- Fixed layout. No scrolling. No scrollbars.
- 4 columns × 2 rows grid. Exact percentages: `grid-template-columns: repeat(4, 1fr)` with `gap: 12px`, identical for rows.
- Each card fills its cell. Internal layout:
  ```
  ┌────────────────────────────────┐
  │ #142              03:47        │  ← order number + timer, top bar
  ├────────────────────────────────┤
  │ 2× Bacon Burger                │
  │   - no onion                   │  ← items + modifiers
  │ 1× Sonoran Dog                 │
  │   - extra beans                │
  │                                │
  │                                │
  ├────────────────────────────────┤
  │ To-go             8:42 PM     │  ← fulfillment + order time, bottom bar
  └────────────────────────────────┘
  ```
- **Timer sits top-right in JetBrains Mono, always visible.** Font size adjusts with card size.
- When elapsed > 3 min → card gains 2px amber border + `--warn` tinted background (6% opacity).
- When elapsed > 7 min → card gains 2px danger border + subtle pulse keyframe (1.5s cycle, opacity 1 → 0.95 → 1). Not aggressive; visible but not panic-inducing.
- Tap target is the entire card. Confirm modal uses `--shadow-pop` and darkens the rest of the screen with `rgba(0,0,0,0.4)`.

### Settings/admin

- Forms are left-aligned, single column, max 640px wide. Label above input, helper text below.
- Save buttons always in a sticky footer on long forms, not at the bottom of the page.

---

## Components (non-exhaustive — implement as needed)

Build these as headless-first using Radix, then style with our tokens. Each gets its own file in `components/ui/`.

- `Button` — variants: `primary`, `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. Always has a focus ring.
- `Input` — underline style on dashboard, full-bordered on KDS (which has no admin inputs anyway).
- `Card` — `bg-raised`, `radius`, `shadow-1`. No border by default.
- `Tag` — small, uppercase, `text-caption`.
- `Toast` — top-right, `shadow-pop`, auto-dismiss 4s.
- `Modal` — full backdrop, centered, `radius-lg`.
- `Table` — see layout rules above.
- `StatCard` — big number in Fraunces display, label in `text-caption`, tiny delta indicator.
- `Chart` — Recharts, with a custom theme file that maps all colors to our tokens.

No shadcn-dump. Copy only the patterns you need.

---

## Iconography

**Phosphor Icons**, `regular` weight, 1.25px stroke at 20px size. One weight only for consistency. Do not mix with Lucide or Heroicons. Do not use emoji as icons.

For the KDS, the only icon used is a small checkmark on the complete-confirm modal; the rest of the interface relies on text and typographic hierarchy.

---

## Accessibility

- Every interactive element reachable by keyboard.
- Focus rings are `outline: 2px solid var(--accent); outline-offset: 2px` — never removed.
- KDS text contrast ratio ≥ 7:1 against its background at its actual rendered size (AAA for critical).
- Dashboard text contrast ≥ 4.5:1 (AA).
- Tap targets ≥ 44×44 px on KDS.
- `prefers-reduced-motion` respected.
- Color is never the sole carrier of meaning (timer state uses color + position + text).

---

## CSS architecture

- **Tailwind v4** with a `@theme` block that maps every token above to Tailwind utilities.
- Custom properties on `:root` (light theme) and on `[data-theme="dark"]` for KDS.
- Global styles in `app/globals.css`: font-face, root vars, sensible resets.
- **No inline styles except for dynamic values** (timer color state, grid cell width calculations).
- **No `@apply` in random files** — keep Tailwind utilities inline in JSX. Save `@apply` for the rare shared primitive.

Example `app/globals.css` starter:

```css
@import 'tailwindcss';

@font-face {
  /* Fraunces, IBM Plex Sans, JetBrains Mono — self-hosted from /public/fonts */
}

:root {
  --bg: #f6f1e8;
  /* ... all tokens from §Color light theme ... */
  --font-display: 'Fraunces', Georgia, serif;
  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

[data-theme='dark'] {
  --bg: #161310;
  /* ... all tokens from §Color dark theme ... */
}

html,
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.55;
}

@theme {
  --color-bg: var(--bg);
  --color-bg-raised: var(--bg-raised);
  --color-ink: var(--ink);
  --color-accent: var(--accent);
  /* ... */
}
```

---

## Anti-patterns — if you see these in the code, fix them

- `shadow-lg` or `shadow-xl` on cards — we don't float things.
- Emojis used as visual anchors or status.
- `rounded-xl` or `rounded-2xl` — we use `--radius` (4px) as the default.
- Gradients on buttons.
- A dark mode toggle on the dashboard. (No. Dashboard is light; KDS is dark. One purpose each.)
- Using `Inter` anywhere.
- Border + shadow + background-color all together on one element.
- Animations longer than 600ms on interactive elements.
- Tooltips on things that don't need tooltips.
- "Skeleton loaders" on the KDS. The KDS is either empty or full. No skeletons.

---

## Inspiration (not to copy, but to calibrate)

Look at these, then do your own thing: Linear's typographic restraint, Rauno Freiberg's detail obsession, Stripe's density without clutter, Tokyobike's warm-minimal web, Bon Appétit magazine's editorial hierarchy, Things 3's quiet opinionation, flight instrumentation UI (for the KDS specifically).

Do not look at: generic Dribbble dashboards, "modern SaaS landing page" collections, any AI-generated UI kit.

---

## The one sentence to remember

**If every screen feels like a single designer with taste made it, we nailed it. If it feels like a framework, we failed.**
