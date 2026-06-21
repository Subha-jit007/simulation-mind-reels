# 📲 How To Upload (Instagram Reels)

The render in `renders/` is already 1080×1920, 30fps, H.264 + AAC — IG-ready.

## Per-post checklist
1. Open the day's note in `Reels/` → copy the **Caption** and **hashtags**.
2. Find the MP4 in `renders/` (e.g. `Day-01 you-will-never-find-the-exit.mp4`).
3. Get it on your phone (Google Drive / Telegram-to-self / USB) **or** post from desktop via
   [business.facebook.com](https://business.facebook.com) / a scheduler (Later, Metricool, Buffer).
4. New Reel → select the video → **Cover:** scrub to a frame with a strong caption line.
5. Paste caption + hashtags. Keep the hook line first.
6. Settings: leave original audio ON (the cinematic mix is baked in). Optionally also add a quiet
   trending audio at ~0% volume for reach — never let it override the serious mix.
7. Post (best windows: ~8–10am or ~7–9pm local).

## Consistency tips
- Same handle, same look every day → the algorithm and humans both reward the streak.
- Pin a 3-reel "best of" once you have a few.
- Reply to early comments fast; it boosts distribution.

## Batch a week ahead
```bash
for d in 1 2 3 4 5 6 7; do node scripts/build_reel.mjs $d; done
node scripts/sync_obsidian.mjs
```
(PowerShell: `1..7 | % { node scripts/build_reel.mjs $_ }`)
