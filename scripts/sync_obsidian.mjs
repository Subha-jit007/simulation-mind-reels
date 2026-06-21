#!/usr/bin/env node
/**
 * sync_obsidian.mjs
 * Regenerates the Obsidian dashboard from content/reels.json:
 *   - Content Calendar.md   (master table of all 51 reels)
 *   - Reels/Day NN — Title.md (one note per reel)
 * content/reels.json is the single source of truth for the renderer AND Obsidian.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
const reelsDir = join(ROOT, "Reels");
mkdirSync(reelsDir, { recursive: true });

const renders = existsSync(join(ROOT, "renders"))
  ? readdirSync(join(ROOT, "renders")).filter((f) => f.endsWith(".mp4"))
  : [];
const dd = (n) => String(n).padStart(2, "0");
const rendered = (day) => renders.some((f) => new RegExp(`^Day-${dd(day)}[ -]`).test(f));
const status = (day) => (rendered(day) ? "🟢 Rendered" : "🔴 Not made");
// strip Windows-illegal filename chars (\ / : * ? " < > |) and trailing dots/spaces
const safe = (s) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
const noteName = (r) => `Day ${dd(r.day)} — ${safe(r.title)}`;

// ---- per-day notes ------------------------------------------------------
for (const r of reels) {
  const hasScript = r.script && r.script.trim().length > 0;
  const body = `---
day: ${r.day}
title: "${r.title.replace(/"/g, "'")}"
status: ${rendered(r.day) ? "rendered" : "planned"}
voice: ${r.voice}
palette: ${r.palette}
tags: [reel, simulation-mind]
---

# Day ${dd(r.day)} — ${r.title}

> [!abstract] Angle
> ${r.idea}

## 🎙️ Script ${hasScript ? "" : "(generate with `/reel`)"}
${hasScript ? r.script : "_Not written yet. Run `/reel " + r.day + "` and Claude will draft it from the angle above + the ChatVault transcript, then render._"}

## 📝 Caption
${r.caption}

\`\`\`
${(r.hashtags || []).join(" ")}
\`\`\`

## 🎬 Production
- **Voice:** ${r.voice}  ·  **Pitch:** ${r.pitch || "-6Hz"}  ·  **Rate:** ${r.rate || "-6%"}
- **Palette:** ${r.palette}
- **CTA:** ${r.cta}
- **Status:** ${status(r.day)}
- **Build:** \`node scripts/build_reel.mjs ${r.day}\`
- **Output:** \`renders/Day-${dd(r.day)} …mp4\`
`;
  writeFileSync(join(reelsDir, `${noteName(r)}.md`), body);
}

// ---- master calendar ----------------------------------------------------
const rows = reels
  .map(
    (r) =>
      `| ${dd(r.day)} | ${r.kicker.split("·")[0].trim()} | [[${noteName(r)}\\|${r.title}]] | ${status(r.day)} | \`${r.voice.replace("Neural", "").replace("en-US-", "").replace("en-GB-", "GB-")}\` |`
  )
  .join("\n");
const doneCount = reels.filter((r) => rendered(r.day)).length;

const cal = `# 🎬 Content Calendar — Simulation & Mind

**51 faceless cinematic reels.** One per day. Source of truth: \`content/reels.json\`.
Progress: **${doneCount} / 51 rendered.**

> [!tip] Make today's reel
> In Claude Code (opened on this vault) type **\`/reel\`** — it picks the next un-rendered day, writes the script if needed, and renders a ready-to-upload MP4 into \`renders/\`.
> Or render a specific day from a terminal: \`node scripts/build_reel.mjs <day>\`

| # | Theme | Reel | Status | Voice |
|---|-------|------|--------|-------|
${rows}

---
*Regenerate this file anytime: \`node scripts/sync_obsidian.mjs\`*
`;
writeFileSync(join(ROOT, "Content Calendar.md"), cal);

console.log(`✓ Synced ${reels.length} reel notes + Content Calendar.md  (${doneCount}/51 rendered)`);
