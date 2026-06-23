---
description: Make today's Simulation & Mind reel — pick next day, write script if needed, edit/render, report upload package
argument-hint: "[day number] (optional; defaults to next un-rendered day) [--premium]"
---

You are producing one finished Instagram reel for the **Simulation & Mind** channel.

## 🎬 Video-editing skills (installed under `.claude/skills/`)
This project ships two matched, agent-driven editing skill packs. **Use them when editing a
new video** (any interactive `/reel` build):

- **`video-editing`** — the editorial standard for creator-grade vertical (9:16) shorts:
  engineered 1–3s hook, A-roll/B-roll spine, non-metronomic cuts (down to 0.2s), eased
  anti-jitter camera moves, kinetic captions/keyword emphasis, themed motion-graphic cards,
  layered SFX mixed under the voice, and a required `init→preview→lint→render→verify` gate.
- **`hyperframes`** (+ `hyperframes-core`, `-cli`, `-animation`, `faceless-explainer`,
  `remotion-to-hyperframes`, …) — the HTML/GSAP→MP4 render engine the `video-editing`
  standard runs on. For this faceless channel, `faceless-explainer` is the natural fit
  (every visual invented: typography, abstract graphics, diagrams) and `video-editing`
  supplies the editorial grammar on top.

These are **agent-driven** (an agent writes the HTML/GSAP and drives the render), so they
power the **interactive build** — NOT the headless GitHub cron. The cron keeps using the
deterministic Remotion pipeline (`build_reel.mjs`) so the autopilot stays zero-touch.

## Step 1 — choose the day
- If `$ARGUMENTS` contains a number, use that day.
- Otherwise read `content/reels.json` and `renders/`, and pick the **lowest `day` that has no
  matching `renders/Day-NN …mp4` file yet**.
- State which day you're making and its title. Note whether `--premium` was passed.

## Step 2 — ensure a script exists
- Read the chosen entry in `content/reels.json`.
- If its `script` is empty:
  - Use the **chatvault** MCP (`chatvault_get_transcript` / `chatvault_search_transcripts`) to pull
    the relevant ideas from the source transcript for this day's `idea`.
  - Write a **70–110 word** narration: deep, serious, declarative, mysterious. Strong 3-second hook,
    one clear idea, a turn, a resonant last line. No emojis, no stage directions, no "welcome back".
  - Save it into that entry's `script` field in `content/reels.json` (keep voice/palette/etc).

## Step 3 — edit & render (pick the engine)

### 3a · Default / autopilot path (Remotion) — fast, deterministic, cron-parity
- Run: `node scripts/build_reel.mjs <day>`
- Generates the deep voiceover, word-timed captions, the cinematic Remotion video, the
  dark-ambient drone, and muxes the final MP4 into `renders/`. This is exactly what the daily
  cron runs, so use it for runway days and any zero-touch build.

### 3b · Premium / hero path (skills) — use when `--premium` or the day deserves a hero edit
Drive the **`video-editing`** skill (built on **`hyperframes`** / `faceless-explainer`). Honor
its non-negotiable workflow:
1. Treat the Day-NN `script` as the spine; build a beat map (hook → idea → turn → last line),
   each beat → invented visual + on-screen super + cut/camera/energy.
2. Reuse the existing **deep edge-tts voiceover** as the A-roll audio. Generate it with the
   same settings the pipeline uses if you don't already have `vo.mp3`:
   `py -m edge_tts --voice <voice> --rate=-12% --pitch=<pitch> --file narration.txt --write-media vo.mp3 --write-subtitles vo.vtt`
3. `npx hyperframes init edit` inside a per-day project folder, build the edit beat-by-beat
   (faceless: typography + abstract/cosmic graphics, NO talking head), keep the
   "simulation terminal" aesthetic (IBM Plex Mono / terracotta #DA7756 / ivory #F0EEE6 / cosmic bg).
4. Author SFX + master audio with ffmpeg and **mix everything UNDER the voice** — keep the
   cinematic dark-ambient drone; never bright/comedic/cartoon SFX.
5. `npx hyperframes preview` → inspect → `npx hyperframes lint` (fix all errors) →
   `npx hyperframes render` → MP4.
6. Verify: `node .claude/skills/video-editing/scripts/verify-render.mjs <mp4>` (asserts
   1080×1920, duration, h264/yuv420p, audio) AND the project's own gate `node scripts/qa.mjs <day>`.
7. Copy the final MP4 to `renders/Day-NN <slug>.mp4` so the upload step finds it.

> ⚠️ Choosing 3b for a day the cron will auto-post means you must clobber that day's GitHub
> Release asset and reconcile `content/state.json` before the cron fires, or the cron will
> post the Remotion version instead. Say so explicitly before doing it.

## Step 4 — refresh the dashboard
- Run: `node scripts/sync_obsidian.mjs`

## Step 5 — report the upload package
Give the user, ready to copy-paste:
- ✅ the output file path under `renders/`
- 📝 the caption
- #️⃣ the hashtags
- 🎙️ which voice was used
- 🎬 which engine was used (Remotion autopilot, or skills/HyperFrames premium)

## 🔊 HARD AUDIO RULES
Deep/serious voice + cinematic dark-ambient music ONLY. Never upbeat, playful, comedic, or
cartoon/kids-style audio — applies to SFX in the premium path too. If anything sounds
childish, stop and fix it before reporting done.
