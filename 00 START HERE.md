# 🌌 Simulation & Mind — Studio

A faceless, cinematic Instagram **Reels** channel. Deep philosophy — simulation theory,
consciousness, ego, the nature of reality — one reel a day, 51 planned.

This folder is **both an Obsidian vault and a Claude Code project**, so you read/plan here and
Claude renders the videos here.

---

## ▶️ Make today's video (2 ways)

**A. With Claude Code (recommended)**
1. Open this folder in Claude Code (`claude` in `E:\ig contetnt`).
2. Type **`/reel`** → it makes the next un-made day and drops a ready-to-upload MP4 in `renders/`.
   - Want a specific one? `/reel 7`

**B. From a terminal (no Claude needed)**
```bash
cd "E:\ig contetnt"
node scripts/build_reel.mjs 1     # build Day 1 (any day 1–51)
node scripts/sync_obsidian.mjs    # refresh this dashboard
```

> Days 1–7 already have full scripts. Days 8–51 have the angle written; `/reel` writes the
> script from that angle + the ChatVault transcript, then renders.

---

## 🗺️ Where things are
- **[[Content Calendar]]** — all 51 reels + status
- `Reels/` — one note per reel (script, caption, hashtags)
- `renders/` — **finished MP4s, ready to upload** ⭐
- `content/reels.json` — the master data (edit to change content)
- **[[How To Upload]]** — posting checklist
- `studio/` — the Remotion video engine
- `chatvault-mcp-server/` — serves the source philosophy transcript to Claude

---

## 🤖 Auto-posting (free, hands-off)
Set it up once (**[[Automation Setup]]**, ~15 min) and a free GitHub Actions robot posts the next
rendered reel to your IG every day by itself. Pieces: `scripts/publish_ig.mjs` + `.github/workflows/daily-reel.yml`.
Just keep a few reels rendered ahead as the queue.

## 🔊 The one rule
**Deep serious voice + cinematic dark-ambient music. Never cartoon / playful / kids audio.**
Built into the pipeline — don't let any edit break it.

---

## 🎨 Optional polish (Canva Pro)
The base reel is fully generated. To enrich a specific day with an AI hero image:
1. In Claude (this vault) ask to generate a surreal cosmic image via the **Canva** MCP, or make one in Canva Pro (Magic Media) and export 1080×1920.
2. Drop it in `studio/public/images/`.
3. (A future `image` layer hook can Ken-Burns it behind the captions — ask Claude to wire it for a given day.)
