# Simulation & Mind — IG Reel Studio

This vault is a **content engine** for a faceless, cinematic Instagram Reels channel about
simulation theory, consciousness, ego, and the nature of reality. One reel per day, 51 planned.

## How it works (the daily loop)
1. `content/reels.json` is the **single source of truth** — 51 reel entries (title, angle, script, voice, palette, caption, hashtags).
2. The **ChatVault MCP** serves the source philosophy transcript(s) so scripts stay grounded in real ideas.
3. `scripts/build_reel.mjs <day>` produces a finished 9:16 MP4 into `renders/`:
   voice (edge-tts) → word-timed captions → Remotion cinematic render → ffmpeg dark-ambient drone + mux.
4. `scripts/sync_obsidian.mjs` regenerates `Content Calendar.md` + `Reels/` notes from the data.

## The `/reel` command
Type `/reel` (optionally `/reel 12`) to make the next reel. It picks the next un-rendered day,
writes the script from the angle + transcript if missing, renders, and reports the upload package.

## 🔊 AUDIO RULES — non-negotiable
- **Deep, serious narration voices only.** Rotate the masculine edge-tts News/Novel voices
  (Guy, Eric, Steffan, Roger, Andrew, Ryan, Thomas). Slight negative pitch for gravitas.
- **Cinematic / dark-ambient music only** (the synthesized drone). **NEVER** upbeat, playful,
  comedic, or "cartoon/kids" audio. This is a hard rule.

## Visual style
Dark cosmic background (drifting stars, nebula glow, faint simulation grid, film grain, vignette),
big serif kinetic captions revealed in sync with the voice, a closing CTA. 1080×1920, 30fps.

## Commands
- `node scripts/build_reel.mjs <day>` — build one reel
- `node scripts/sync_obsidian.mjs` — refresh calendar + notes
- `cd studio && npm run studio` — open Remotion Studio to preview/tweak the composition

## File map
- `content/reels.json` — the 51-reel data (edit here to change content)
- `studio/` — Remotion engine (`src/Reel.tsx`, `src/components/*`, `src/data/reel.json` is generated per build)
- `scripts/` — pipeline (build_reel.mjs, sync_obsidian.mjs)
- `renders/` — finished MP4s, ready to upload
- `Reels/`, `Content Calendar.md` — Obsidian dashboard (generated)
- `chatvault-mcp-server/` — the MCP that serves source transcripts
- `toolkit/` — claude-code-video-toolkit (Remotion skills reference)
