#!/usr/bin/env bash
# Renders each board of visual-key.html to a PNG in design/visual-key/ at 2x
# (3200px wide). Needs Chrome; run from anywhere: bash design/export-visual-key.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/visual-key"
mkdir -p "$OUT"

CHROME=""
for c in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "/usr/bin/google-chrome" "/usr/bin/chromium" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  [ -f "$c" ] && CHROME="$c" && break
done
[ -n "$CHROME" ] || { echo "Chrome not found" >&2; exit 1; }

# Windows Chrome wants a Windows path in the file:// URL.
PAGE="$HERE/visual-key.html"
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) PAGE="$(cygpath -m "$PAGE")";; esac

# id:height — heights match the inline style on each .board
BOARDS="kv:900 palette:960 type:900 materials:1000 prompts:1160 rules:690"
NAMES="kv:01-key-visual palette:02-palette type:03-logo-and-type materials:04-materials-and-motifs prompts:05-higgsfield-prompts rules:06-do-dont"

name_for() { for n in $NAMES; do [ "${n%%:*}" = "$1" ] && echo "${n#*:}" && return; done; }

for b in $BOARDS; do
  id="${b%%:*}"; h="${b#*:}"; file="$OUT/$(name_for "$id").png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size="1600,$h" \
    --virtual-time-budget=10000 \
    --screenshot="$file" "file:///$PAGE?board=$id" >/dev/null 2>&1
  echo "wrote $file"
done
