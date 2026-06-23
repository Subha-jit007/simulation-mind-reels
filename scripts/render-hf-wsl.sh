#!/usr/bin/env bash
# Render "Simulation & Mind" reels via the HyperFrames (premium / "alive") pipeline.
# Runs in WSL2 Ubuntu (Linux x64 — the supported HyperFrames platform).
#
# Usage (from a WSL shell, repo on /mnt/e):
#   bash scripts/render-hf-wsl.sh 3 4 5            # render days 3,4,5
#   QUALITY=draft bash scripts/render-hf-wsl.sh 7  # fast preview
#
# QUALITY = draft | standard | high   (default standard)
# One-time toolchain (already set up): node via nvm, ffmpeg + libnss3/libnspr4/
# libasound2t64 via apt, edge-tts via pip --user, and chrome-headless-shell
# 131.0.6778.85 in ~/.cache/hyperframes (fetched from the Chrome-for-Testing CDN).
set -u
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; nvm use --lts >/dev/null 2>&1 || true
# Force the Linux toolchain — strip Windows /mnt/c PATH bleed, add user-local bin (edge-tts).
export PATH="$HOME/.local/bin:$(echo "$PATH" | tr ':' '\n' | grep -v '^/mnt/c' | paste -sd ':' -)"
export QUALITY="${QUALITY:-standard}"
export PYTHON=python3
cd "$(dirname "$0")/.."
echo "node=$(node -v) npx=$(command -v npx) ffmpeg=$(command -v ffmpeg) QUALITY=$QUALITY"
ok=""; fail=""
for d in "$@"; do
  echo "==================== DAY $d START ===================="
  if node scripts/build_reel_hf.mjs "$d"; then ok="$ok $d"; else fail="$fail $d"; echo "DAY $d FAILED (continuing)"; fi
done
echo "### DONE — ok:[$ok ] failed:[$fail ] ###"
