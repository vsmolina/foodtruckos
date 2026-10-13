# Barrio Burger Co. — website (`apps/site`)

The customer-facing site for the truck: live open/closed status, the menu,
order-ahead pickup, Find Us, the Night on the Square gallery, partners, specials
signup, Raíces (our story), catering and merch, plus a phone-friendly admin.

- **How it fits with the truck's system:** [PLAN.md](PLAN.md). Square is the
  bridge for menu and food orders. Online orders appear on the existing kitchen
  screen with no KDS changes.
- **Design system and handmade rules:** [design/DESIGN.md](design/DESIGN.md).
  Tokens are in [design/tokens.json](design/tokens.json); every component state
  is live at `/styleguide`.

## Run it locally

Needs Node 22+, pnpm, and the foodtruck-os Docker Postgres (port 5433).

```bash
cd foodtruck-os
docker compose -f infra/docker-compose.yml -f infra/docker-compose.ports.yml up -d postgres
docker compose -f infra/docker-compose.yml exec postgres psql -U foodtruck -d foodtruck -c 'create database barrio_site'   # once
cp apps/site/.env.example apps/site/.env     # fill SESSION_SECRET + ADMIN_PASSWORD_HASH at least
pnpm --filter site admin:hash-password 'a long password'   # → ADMIN_PASSWORD_HASH
pnpm --filter site db:migrate
pnpm --filter site db:seed                   # sample menu, hours, specials, partners, merch
pnpm --filter site dev                       # http://localhost:3020
```

Admin is at `/admin`.

With no keys configured, everything still works end to end:
- **Texts and emails** are printed to the terminal and saved in the
  `message_log` table.
- **Uploads** go to `public/uploads`.
- **Food checkout** runs in mock mode: no card is charged and the order is
  accepted immediately.
- **Merch checkout** skips Stripe.

Mock modes are disabled in production.

To use the real Square **sandbox**:
1. Put the same Square values as foodtruck-os in `apps/site/.env`.
2. Open Admin → Menu → **Sync from Square**.
3. Run foodtruck-os (`pnpm dev` on :3010) so orders show on the KDS.
4. Pay with the test card `4111 1111 1111 1111`, CVV 111, any future date, ZIP 12345.

Useful scripts (`pnpm --filter site <script>`): `dev`, `build`, `lint`,
`typecheck`, `db:generate` (after a schema change), `db:migrate`, `db:seed`,
`square:sync-menu`, `admin:hash-password`.

## Deploy (Vercel + Neon)

1. **Database:** create a Neon project. Copy the **pooled** connection string
   into `DATABASE_URL`, then run `pnpm --filter site db:migrate` against it once
   from your machine. Seed only if you want the samples.
2. **Vercel project:** import the GitHub repo and set **Root Directory =
   `apps/site`**. Framework is Next.js, and the install command is the default
   (pnpm workspace).
3. **Environment variables:** add every variable in
   [.env.example](.env.example) that you use. At minimum:
   - `SITE_URL`
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `ADMIN_PASSWORD_HASH`
   - the Square values, with `SQUARE_ENVIRONMENT=production`
   - `BLOB_READ_WRITE_TOKEN`: connect a Blob store under Storage.
4. **Domain:** add it in Vercel → Domains and set `SITE_URL` to match.
5. **Square webhook for the site:** in the Developer Dashboard → Webhooks
   (Production), add a subscription.
   - URL: `https://<domain>/api/webhooks/square`
   - Events: `order.fulfillment.updated`, `order.updated`, `catalog.version.updated`
   - Copy the signature key to `SQUARE_WEBHOOK_SIGNATURE_KEY`, and set
     `SQUARE_WEBHOOK_NOTIFICATION_URL` to the same URL.
   - This is separate from the truck's own subscription.
6. **Stripe (merch):**
   - Turn on Stripe Tax and add a Texas registration.
   - Add a webhook to `https://<domain>/api/webhooks/stripe` for
     `checkout.session.completed` and `checkout.session.expired`.
   - Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
7. **Twilio (SMS):**
   - Register A2P 10DLC (1–3 weeks; start early). Use the consent wording from
     `/specials` and `/order/checkout` as your samples.
   - Create a Messaging Service with Advanced Opt-Out on.
   - Point its incoming-message webhook to `https://<domain>/api/webhooks/twilio`.
   - Set the `TWILIO_*` variables.
8. **Email:** verify your domain in Resend and set `RESEND_API_KEY`,
   `EMAIL_FROM` and `OWNER_EMAIL`.
9. **Truck dashboard (optional):** set `SITE_ADMIN_API_TOKEN` here and the same
   value plus `SITE_URL=https://<domain>` in the truck's `.env` to enable its
   Website tabs.
10. **Instagram cron:** set `CRON_SECRET` to a random string
    (`openssl rand -hex 32`). `vercel.json` already schedules the daily
    Instagram refresh, which keeps the token renewed. Optionally add
    `INSTAGRAM_APP_ID` and `INSTAGRAM_CLIENT_TOKEN` (see "Instagram posts" below).
11. **Kitchen wait (optional):** set `KITCHEN_API_URL` to the truck's tunnel URL.
   Set `KITCHEN_API_TOKEN` to the same value in both apps.
12. **Smoke test:** set status to Open, place a $1 order, and check that it shows
    on the kitchen screen. Tap it done; the status page should say Ready and the
    text should arrive. Refund it in Square.

## Managing the site from the truck dashboard

The foodtruck-os dashboard (`apps/web`) has a **Website** section with tabs for
everything below, so the owner can run the truck and the website from one place.
It talks to this site's admin API:

- `POST /api/admin/v1/<op>` with `Authorization: Bearer $SITE_ADMIN_API_TOKEN`.
  The ops and their types live in `packages/site-contract`; the logic in
  `lib/admin/*` is shared with this site's own `/admin`.
- Set the **same** random token (`openssl rand -hex 32`) as
  `SITE_ADMIN_API_TOKEN` here and in the root `.env`, plus `SITE_URL` (this
  site's URL) in the root `.env`. The API is off when the token is unset.
- Food items are still created under the dashboard's **Menu** (they go to
  Square); after each push the dashboard asks the site to re-sync, and the
  **Menu extras** tab adds the website-only bits (photo, Spanish tagline,
  hidden, NEW).
- This site's `/admin` keeps working on its own, e.g. from a phone when the
  truck's PC is off.

## Running the admin (from your phone)

| Screen | What it's for |
|---|---|
| **Today** | Tonight at a glance: status, web orders, new catering leads, photos waiting, merch to ship. |
| **Status** | One tap for **Open now / Back soon / Closed**; the whole site changes instantly. **Pause orders** during a rush (customers see your pause message and order at the window). Also the message under the banner, default wait, weekly hours, location and Instagram. |
| **Orders** | Tonight's online orders. Status normally moves by itself from the kitchen screen; buttons let you override it (Ready also texts the customer). |
| **Menu** | **Sync from Square** after changing names or prices in Square. Mark items **Sold out**, **Hidden** or **NEW**; add a Spanish tagline and a website photo. |
| **Specials** | Create a special with an optional sticker, price and start/end time. Live specials show on Home and Specials. |
| **Catering** | Leads move New → Contacted → Quoted → Booked / Declined. Tap to call, text or email, and keep private notes. |
| **Gallery** | Approve or reject submitted photos and upload your own. Before any photo can go live, someone has to confirm that everyone identifiable in it agreed. Takedown requests: one tap removes the photo and resolves the request. **Instagram:** connect once and the gallery page shows your 3 latest posts (see below). |
| **Partners** | Bars and bartenders: each gets a code, a link and a printable QR card. Shows scans, orders and revenue per partner. |
| **Merch** | Products, sizes/colors, stock, photos; orders to pack and ship (add tracking → customer gets an email). |
| **Subscribers** | Who's signed up (email / text), CSV export, and **Broadcast**: write a message, preview it, and send it to opted-in people only. |
| **Analytics** | Visits and orders by weekday × hour (spot the slow Thu/Fri early evenings), top pages, partner referrals, catering pipeline, merch revenue. |

## Instagram posts on the gallery page

`/gallery` shows the 3 latest posts from your Instagram as Instagram's own
embeds. Each one links to the post. Connect it once from Admin → Gallery or from
the truck dashboard (Website → Gallery):

1. Make your Instagram a **Professional** account (Business or Creator):
   Instagram → Settings → Account type.
2. At [developers.facebook.com/apps](https://developers.facebook.com/apps),
   create an app and add the **Instagram** product.
3. Under **API setup with Instagram login**, add your account and click
   **Generate token**.
4. Paste the token into the Gallery admin and click **Connect Instagram**.

After that it runs by itself:
- New posts appear within about 30 minutes. The site checks after a gallery
  visit, at most every 30 minutes, plus the daily cron.
- The token (good for 60 days) renews itself weekly.
- Only each post's id, link, type and date are stored. Instagram renders the
  post itself.
- If something breaks, the posts already shown stay up and the admin shows what
  went wrong.

**Official embeds (optional).** Set `INSTAGRAM_APP_ID` and
`INSTAGRAM_CLIENT_TOKEN` (Meta app → App settings → Basic / Advanced) to fetch
embeds from Meta's oEmbed endpoint. It only works after Meta approves the app's
**"Meta oEmbed Read"** feature in App Review. Until then the site uses
Instagram's standard embed code, which looks the same, and the admin shows which
one is in use.

Code: `lib/instagram.ts`. For local testing without a real account, set
`INSTAGRAM_API_BASE` to a mock of `graph.instagram.com` (ignored in production).

## Things the owner still needs to provide

- **The flyers:** put scans in `design/flyers/`. The palette and lettering are
  provisional until then (DESIGN.md §1).
- **The hand-drawn logo:** save it as `public/brand/logo.svg` and set
  `NEXT_PUBLIC_LOGO_READY=1`.
- **Real photos:** menu photos through Admin → Menu; story and gallery photos
  through the admin.
- **Instagram:** connect it in Admin → Gallery (steps above).
- **Content and details:**
  - Your own story on `/story` (the PLACEHOLDER blocks in
    `app/(public)/story/page.tsx`).
  - Raíces video IDs in `lib/story.ts`.
  - Real weekly hours.
  - The exact map pin.
  - Real partners.
- **Legal:** fill in the bracketed blanks in `/privacy` and `/terms`, then have a
  lawyer review both.
