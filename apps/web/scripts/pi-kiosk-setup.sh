#!/usr/bin/env bash
#
# pi-kiosk-setup.sh — turn a Raspberry Pi into a full-screen KDS kiosk.
#
# Copy this file onto the Pi (e.g. `scp scripts/pi-kiosk-setup.sh pi@raspberrypi.local:`)
# and run it there. It installs Chromium, disables screen blanking, and sets
# Chromium to launch in kiosk mode at boot, pointed at the KDS on the Mac's LAN IP.
#
# Usage (on the Pi):
#   ./pi-kiosk-setup.sh <MAC_LAN_IP> <STORE_ID> [PORT]
#
# Example:
#   ./pi-kiosk-setup.sh 192.168.1.42 019f4877-b6ea-7ee6-b84b-9794b488f33f 3000
#
# Find the Mac's LAN IP by running THIS on the Mac (not the Pi):
#   ipconfig getifaddr en0    # Wi-Fi; try en1 for a second interface / Ethernet
#
# Find the STORE_ID by running THIS on the Mac (in apps/web):
#   pnpm --filter web exec tsx -e "import('./lib/kds/snapshot').then(m=>m.defaultStoreId()).then(console.log)"
#   # or: psql "$DATABASE_URL" -c "select id, name from stores;"
#
set -euo pipefail

MAC_IP="${1:-}"
STORE_ID="${2:-}"
PORT="${3:-3000}"

if [[ -z "$MAC_IP" || -z "$STORE_ID" ]]; then
  echo "usage: $0 <MAC_LAN_IP> <STORE_ID> [PORT]" >&2
  exit 1
fi

KDS_URL="http://${MAC_IP}:${PORT}/kds?store=${STORE_ID}"
echo "Kiosk will open: ${KDS_URL}"

# 1. Chromium — Raspberry Pi OS packages it as chromium-browser (older) or chromium (newer).
if command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
  CHROMIUM=chromium
else
  echo "Installing Chromium…"
  sudo apt-get update
  sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium
  CHROMIUM=$(command -v chromium-browser || command -v chromium)
fi
echo "Using browser: ${CHROMIUM}"

# Flags: kiosk full-screen, no first-run prompts, no crash/restore bubbles, cursor
# still available for setup (the KDS itself needs no mouse once running).
CHROMIUM_FLAGS="--kiosk --incognito --noerrdialogs --disable-infobars \
--disable-session-crashed-bubble --disable-features=TranslateUI \
--check-for-update-interval=31536000 --start-fullscreen \"${KDS_URL}\""

# 2. Autostart. Bookworm+ defaults to the labwc/Wayland desktop; older releases
#    use the LXDE/X11 session. Write both so this works across images.
LAUNCH_CMD="${CHROMIUM} ${CHROMIUM_FLAGS}"

# 2a. labwc (Wayland, Raspberry Pi OS Bookworm and later)
LABWC_DIR="${HOME}/.config/labwc"
mkdir -p "${LABWC_DIR}"
AUTOSTART_LABWC="${LABWC_DIR}/autostart"
if ! grep -q "kds?store=" "${AUTOSTART_LABWC}" 2>/dev/null; then
  {
    echo "# KDS kiosk (added by pi-kiosk-setup.sh)"
    # Wayland screen-blanking off; swayidle/wlopm vary by image, so keep it simple.
    echo "${LAUNCH_CMD} &"
  } >> "${AUTOSTART_LABWC}"
  echo "Wrote labwc autostart: ${AUTOSTART_LABWC}"
fi

# 2b. LXDE (X11, older Raspberry Pi OS)
LXDE_DIR="${HOME}/.config/lxsession/LXDE-pi"
mkdir -p "${LXDE_DIR}"
AUTOSTART_LXDE="${LXDE_DIR}/autostart"
if ! grep -q "kds?store=" "${AUTOSTART_LXDE}" 2>/dev/null; then
  {
    echo "@xset s off"          # no screen saver
    echo "@xset -dpms"          # no display power management (no blanking)
    echo "@xset s noblank"
    echo "@${LAUNCH_CMD}"
  } >> "${AUTOSTART_LXDE}"
  echo "Wrote LXDE autostart: ${AUTOSTART_LXDE}"
fi

echo
echo "Done. Reboot the Pi to launch the kiosk:  sudo reboot"
echo "To test now without rebooting (from the Pi desktop):"
echo "  ${LAUNCH_CMD}"
