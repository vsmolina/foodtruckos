# 00 — Pre-Flight Checklist

**Run every command in this file on your Mac before you open Claude Code.** Each step verifies something concrete. Don't skip any. If a step fails, stop and fix it — Claude Code will flail if its environment is broken.

Expected time: 20–40 minutes.

---

## 1. Verify your Mac is capable

Open Terminal (Cmd+Space → "Terminal").

```bash
sw_vers
```

Expected: macOS 13 (Ventura) or newer. If you're on 12 or older, upgrade first.

```bash
uname -m
```

Expected: `arm64` (Apple Silicon) or `x86_64` (Intel). Either works. Note which one — it affects Docker image selection later.

---

## 2. Install the base toolchain

### Homebrew (package manager for Mac)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After install, follow the on-screen instructions to add brew to your PATH (it will tell you exactly what to paste).

Verify:

```bash
brew --version
```

### Git, Node, Docker Desktop, Cloudflared

```bash
brew install git node pnpm
brew install --cask docker
brew install cloudflared
```

Launch Docker Desktop from Applications and let it finish starting (whale icon in the menu bar stops animating).

Verify everything:

```bash
git --version        # expect 2.4x+
node --version       # expect v20+ or v22+
pnpm --version       # expect 9+
docker --version     # expect 27+
docker compose version  # expect v2.x
cloudflared --version
```

If any of these fail, stop and fix it.

---

## 3. Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

Then authenticate:

```bash
claude
```

It will walk you through login. Use the same Anthropic account you use for claude.ai.

---

## 4. Create the project directory

```bash
mkdir -p ~/Code/foodtruck-os
cd ~/Code/foodtruck-os
git init
```

Copy the four `.md` files from this package into `~/Code/foodtruck-os/docs/`:

```bash
mkdir docs
# then drag the .md files into that folder in Finder, or `mv` them from wherever they are
```

You should have:

```
~/Code/foodtruck-os/
├── .git/
└── docs/
    ├── 00-PREFLIGHT.md       (this file)
    ├── 01-ARCHITECTURE.md
    ├── 02-BUILD-SPEC.md
    └── 03-DESIGN-SYSTEM.md
```

---

## 5. Get your Square developer credentials

This is the one thing Claude Code can't do for you — it requires a human web flow. Square is far simpler than the old Poynt flow: no RSA keypair, no JWT exchange — just an access token.

1. Go to https://developer.squareup.com and sign in with the **same Square account** that runs the food truck. Accept the developer terms.
2. Create a new **Application** named `foodtruck-os`. This gives you a **Sandbox** environment and a **Production** environment side by side.
3. In the application's **Credentials** tab, note:
   - **Application ID** (looks like `sq0idp-...` for production, `sandbox-sq0idb-...` for sandbox).
   - **Access Token** — there's a separate one for Sandbox and Production. For a single merchant, the Production **Personal Access Token** is all you need (no OAuth, no refresh tokens). Treat it like a password.
4. Get your **Location ID**: Square Dashboard → **Account & Settings → Business → Locations**, or call the Locations API. It looks like `L8N6...`. The truck is one location.
5. **Webhook signature key** comes later — you'll create the webhook subscription in Phase 2 (Developer Dashboard → your app → **Webhooks → Subscriptions**), and Square shows the **Signature Key** there. Note it then.

> If you use OAuth instead of a personal token (only needed for multi-merchant), request scopes: `ORDERS_READ`, `ORDERS_WRITE`, `ITEMS_READ`, `ITEMS_WRITE`, `PAYMENTS_READ`, `MERCHANT_PROFILE_READ`.

Put these values in a text file temporarily — you'll paste them into `.env` later:

- `SQUARE_ENVIRONMENT=` (`sandbox` while testing, `production` when live)
- `SQUARE_ACCESS_TOKEN=`
- `SQUARE_APPLICATION_ID=`
- `SQUARE_LOCATION_ID=`
- `SQUARE_WEBHOOK_SIGNATURE_KEY=` (fill in during Phase 2)

**No production access yet?** Tell Claude Code to build against the **Square Sandbox** (test access token + the Sandbox seller dashboard, which can create fake orders/payments). The system runs end-to-end on sandbox data and you flip `SQUARE_ENVIRONMENT=production` when ready.

---

## 6. Find your Raspberry Pi on the network

Power on the Pi, make sure it's on your Wi-Fi, then on your Mac:

```bash
# replace 192.168.1 with your actual subnet if different
arp -a | grep -i raspberry
```

You should see something like `raspberrypi.lan (192.168.1.47) at xx:xx...`. Write down the IP.

SSH into it:

```bash
ssh pi@raspberrypi.lan
# or ssh pi@<the IP you found>
```

Default password is usually `raspberry` (change it if you haven't).

Once in, verify:

```bash
uname -a            # should say aarch64 or armv7l
cat /etc/os-release # should say Raspberry Pi OS or Debian
```

Type `exit` to disconnect.

---

## 7. Set up Cloudflare Tunnel (for Square webhooks)

You need a public HTTPS URL so Square can deliver webhooks to your Mac. Cloudflare Tunnel is free and doesn't require opening router ports. (Square requires a publicly reachable HTTPS endpoint and will send a verification request when you create the subscription.)

1. Make a free Cloudflare account at https://cloudflare.com.
2. Buy a cheap domain (or use one you own) and add it to Cloudflare — the free plan is fine. If buying, `$10/yr on Cloudflare Registrar` is cheapest. You'll only use a subdomain of this.
3. Run:
   ```bash
   cloudflared tunnel login
   ```
   A browser opens. Pick your domain and authorize.
4. Create a tunnel:
   ```bash
   cloudflared tunnel create foodtruck-os
   ```
   It prints a tunnel UUID and saves a credentials JSON. Note the UUID.
5. Route a subdomain to the tunnel (replace `yourdomain.com`):
   ```bash
   cloudflared tunnel route dns foodtruck-os api.yourdomain.com
   ```

Don't start the tunnel yet — the build spec will tell Claude Code how to wire it into Docker Compose.

---

## 8. Final sanity check

Run every one of these. All should succeed:

```bash
cd ~/Code/foodtruck-os
ls docs/                    # should list all 4 .md files
git status                  # should say "on branch main" or similar
docker run hello-world      # should pull and print a greeting
claude --version            # should print a version
node -e "console.log('ok')" # should print ok
```

If every command above works, you're ready.

---

## 9. Start Claude Code

```bash
cd ~/Code/foodtruck-os
claude
```

When Claude Code opens, **paste this exact first message**:

> Read `docs/01-ARCHITECTURE.md`, `docs/02-BUILD-SPEC.md`, and `docs/03-DESIGN-SYSTEM.md` in that order. Then give me a summary of your understanding, list any ambiguities, and propose the order you'll implement phases in. Do not write any code yet.

This forces Claude Code to read everything before acting. Review its summary; if anything looks off, correct it before letting it start Phase 1.
