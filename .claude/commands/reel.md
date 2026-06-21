---
description: Make today's Simulation & Mind reel — pick next day, write script if needed, render, report upload package
argument-hint: "[day number] (optional; defaults to next un-rendered day)"
---

You are producing one finished Instagram reel for the **Simulation & Mind** channel.

## Step 1 — choose the day
- If `$ARGUMENTS` contains a number, use that day.
- Otherwise read `content/reels.json` and `renders/`, and pick the **lowest `day` that has no
  matching `renders/Day-NN …mp4` file yet**.
- State which day you're making and its title.

## Step 2 — ensure a script exists
- Read the chosen entry in `content/reels.json`.
- If its `script` is empty:
  - Use the **chatvault** MCP (`chatvault_get_transcript` / `chatvault_search_transcripts`) to pull
    the relevant ideas from the source transcript for this day's `idea`.
  - Write a **70–110 word** narration: deep, serious, declarative, mysterious. Strong 3-second hook,
    one clear idea, a turn, a resonant last line. No emojis, no stage directions, no "welcome back".
  - Save it into that entry's `script` field in `content/reels.json` (keep voice/palette/etc).

## Step 3 — render
- Run: `node scripts/build_reel.mjs <day>`
- This generates the deep voiceover, word-timed captions, the cinematic Remotion video, the
  dark-ambient drone, and muxes the final MP4 into `renders/`.

## Step 4 — refresh the dashboard
- Run: `node scripts/sync_obsidian.mjs`

## Step 5 — report the upload package
Give the user, ready to copy-paste:
- ✅ the output file path under `renders/`
- 📝 the caption
- #️⃣ the hashtags
- 🎙️ which voice was used

## 🔊 HARD AUDIO RULES
Deep/serious voice + cinematic dark-ambient music ONLY. Never upbeat, playful, comedic, or
cartoon/kids-style audio. If anything sounds childish, stop and fix it before reporting done.
