# Barrio Burger Co. website — plan

Customer-facing site for the truck. Lives in the foodtruck-os monorepo as
`apps/site`, next to the truck's kitchen system (`apps/web`).

## Integration with foodtruck-os

The truck's system runs on a mini PC **in the truck** (KDS, dashboard, Square
webhooks). When the truck is off, so is that PC — so the website must not depend
on it. **Square is the bridge**; the website has its **own cloud database**.

| Shared thing | Source of truth | How the site gets it |
|---|---|---|
| Menu, prices, sizes, modifiers, photos | Square Catalog | `lib/square/sync.ts` pulls the catalog into the site DB (admin "Sync from Square", or the `catalog.version.updated` webhook). Web-only fields (Spanish tagline, photo override, hidden, NEW) stay local. |
| Sold out | Square location override **or** site toggle | Read on sync; admin toggle on `/admin/menu`. |
| Online food orders | Square Orders | Site creates a Square order (PICKUP fulfillment, `source.name = "Barrio website"`) and pays it (Web Payments SDK token). Square's webhook delivers it to foodtruck-os → **ticket on the KDS with no KDS changes**. Tax is computed by Square from the location's tax settings. |
| Order status | Square fulfillment state | foodtruck-os moves the PICKUP fulfillment: ticket created → `RESERVED` (Preparing), ticket done → `PREPARED` (Ready), recall → `RESERVED`. Site reads it (status-page polling + `order.fulfillment.updated` webhook) → Received → Preparing → Ready, and texts the customer on Ready. |
| Open / closed / back soon, ordering paused | Site DB (`site_settings`) | `/admin/status` on the owner's phone. The POS can set it via `POST /api/integrations/status` (bearer `SITE_INTEGRATION_TOKEN`). |
| Current wait | foodtruck-os `GET /api/public/kitchen` (via the tunnel) | Best effort, 1.5 s timeout, falls back to the admin's default wait. |
| Latest Instagram posts on `/gallery` | Instagram (official API, owner's Professional account) | `lib/instagram.ts`: the token is pasted once in the Gallery admin and renews itself weekly. The 3 newest posts' ids and links are kept in `instagram_posts` and shown as Instagram embeds: oEmbed when the app is approved (`INSTAGRAM_APP_ID` + `INSTAGRAM_CLIENT_TOKEN`), the standard embed markup otherwise. Refreshes run after a gallery view (at most every 30 min) and from a daily Vercel cron. |
| Managing the website from the truck dashboard | Site DB, via the site's admin API | foodtruck-os **Website** tabs call `POST /api/admin/v1/<op>` server-to-server (bearer `SITE_ADMIN_API_TOKEN`). Ops and types: `packages/site-contract`. The same logic (`lib/admin/*`) backs the site's own `/admin`, so either place works; the site admin stays available when the truck PC is off. |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · **Drizzle** + Postgres (same
ORM as foodtruck-os; Prisma would mean two ORMs in one repo) · Zod · **Square**
(food orders) · **Stripe Checkout + Stripe Tax** (merch) · Twilio (SMS) · Resend
(email) · Vercel Blob (uploads) · deploy: **Vercel + Neon**.

Every integration is optional in development: without keys, SMS/email are logged
to the console and `message_log`, uploads go to `public/uploads`, and food
checkout runs in **mock** mode (never in production).

## Pages

Public (`app/(public)`): `/` home + live status · `/menu` · `/order` (cart +
checkout) · `/order/[token]` status · `/find-us` · `/gallery` (+ submit,
takedown) · `/partners` · `/r/[code]` referral redirect · `/specials` signup ·
`/unsubscribe/[token]` · `/story` · `/catering` · `/merch`, `/merch/[slug]`,
`/merch/cart`, `/merch/success` · `/privacy` · `/terms` · `/styleguide` (component
states; noindex).

Admin (`app/admin/(panel)`, password + signed cookie): Today · Status (open /
closed / back soon, message, pause ordering, default wait, location, hours) ·
Orders (web orders, manual status override) · Menu (sync, sold out, hide,
photos, Spanish labels) · Specials (+ send to subscribers) · Catering (pipeline)
· Gallery (approval queue, owner uploads, takedowns) · Partners (codes, QR,
performance) · Merch (products, variants, stock, orders) · Subscribers (list,
broadcasts) · Analytics (traffic + orders by hour × weekday, referrals,
catering pipeline).

## Data models

See `lib/db/schema.ts`. site_settings, weekly_hours, menu_categories,
menu_items, menu_variations, menu_modifiers, specials, web_orders, partners,
partner_visits, gallery_photos, takedown_requests, catering_leads, subscribers,
broadcasts, merch_products, merch_variants, merch_orders, page_views,
rate_limits, message_log.

## Build phases

1. Foundation: design system, layout, Home + live status, Menu, Find Us, Story.
2. Admin basics: status, menu, specials.
3. Catering form + lead pipeline.
4. Order ahead: Square payments, KDS via Square, status page, SMS.
5. Gallery with consent + approval; Partners + referral tracking.
6. Merch store (Stripe).
7. Subscribers + broadcasts; analytics.

## Conventions (for everyone building here)

- Server components by default; mutations are server actions validated with Zod.
  **Every admin page and admin server action calls `requireAdmin()`.**
- Never trust client prices: recompute every total on the server from the DB /
  Square.
- Public forms: Zod + `Honeypot` + `rateLimit()`; show field errors with
  `FieldError`. Consent checkboxes are never pre-checked, and the exact consent
  text shown is stored with the record.
- Public UI: the handmade treatments in `design/DESIGN.md`. Admin UI:
  `components/admin/ui.tsx`, utilitarian.
- Spanish for decoration (kickers, stickers); ordering, prices, forms, consent
  and legal text in plain English.
