#!/usr/bin/env node
/**
 * refill.mjs — keep the schedule from running dry.
 *
 * The original plan was 51 days. Day 46 posted on 5 Aug, which left four days
 * of content and a silent account after that. Silence costs more than any
 * single reel: the account stops being distributed and the 46 days of warm-up
 * are wasted.
 *
 * There is no LLM in the cron, so this does not invent philosophy. It re-cuts
 * the reels that actually performed: same idea, fresh edit — new palette, new
 * length, new motif seed, different voice — which is ordinary practice for a
 * growth account and is the honest thing to do with your own back catalogue.
 * Only reels older than MIN_AGE_DAYS are eligible, and the least recently
 * recycled wins, so nothing repeats close together.
 *
 * Genuinely new material still comes from Subha running `/reel` interactively.
 * This is the floor, not the ceiling — it guarantees there is always something
 * to post.
 *
 * Run: node scripts/refill.mjs [--keep-ahead N] [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const KEEP_AHEAD = Number(args.includes("--keep-ahead") ? args[args.indexOf("--keep-ahead") + 1] : 7);
const MIN_AGE_DAYS = 25; // how stale a reel must be before it can be re-cut

const rd = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const reelsPath = join(ROOT, "content", "reels.json");
const reels = rd(reelsPath, []);
const state = rd(join(ROOT, "content", "state.json"), { posted: [] });
const analytics = rd(join(ROOT, "content", "analytics.json"), []);
const posted = new Set(state.posted || []);

const unposted = reels.filter((r) => !posted.has(r.day));
console.log(`${reels.length} reels · ${posted.size} posted · ${unposted.length} queued`);
if (unposted.length >= KEEP_AHEAD) {
  console.log(`Queue is ${unposted.length} deep (want ${KEEP_AHEAD}). Nothing to do.`);
  process.exit(0);
}

// Rank the back catalogue by whatever signal the agent last managed to read.
const latest = analytics[analytics.length - 1];
const perf = new Map();
for (const m of latest?.media || []) {
  const score = m.retention ?? m.views ?? (m.likes || 0) + (m.comments || 0) * 3;
  if (m.day != null) perf.set(m.day, score);
}

const PALETTES = ["void", "signal", "ember"];
const VOICES = ["en-US-AndrewNeural", "en-GB-ThomasNeural", "en-US-GuyNeural", "en-US-EricNeural"];
const LENGTHS = [13, 16, 20];

let maxDay = Math.max(...reels.map((r) => r.day));
const need = KEEP_AHEAD - unposted.length;
const added = [];

for (let k = 0; k < need; k++) {
  // Eligible: already posted, old enough, and an original rather than a
  // re-cut of a re-cut.
  const eligible = reels
    .filter((r) => posted.has(r.day))
    .filter((r) => r.source !== "recut")
    .filter((r) => maxDay - r.day >= MIN_AGE_DAYS)
    .sort((a, b) => {
      const rc = (a.recutCount || 0) - (b.recutCount || 0);
      if (rc !== 0) return rc;                              // least recycled first
      return (perf.get(b.day) ?? 0) - (perf.get(a.day) ?? 0); // then best performing
    });

  if (!eligible.length) { console.log("No eligible reel to re-cut — queue stays short."); break; }

  const src = eligible[0];
  src.recutCount = (src.recutCount || 0) + 1;
  maxDay += 1;

  const next = {
    day: maxDay,
    title: src.title,
    kicker: `RERUN · ${maxDay}`,
    palette: PALETTES[maxDay % PALETTES.length],
    voice: VOICES[maxDay % VOICES.length],
    rate: src.rate || "-6%",
    pitch: src.pitch || "-4Hz",
    idea: src.idea,
    script: src.script,
    cta: src.cta,
    caption: src.caption,
    hashtags: src.hashtags,
    targetSeconds: LENGTHS[maxDay % LENGTHS.length],
    source: "recut",
    of: src.day,
  };
  reels.push(next);
  added.push(`day ${maxDay} ← re-cut of day ${src.day} "${src.title}" · ${next.targetSeconds}s · ${next.palette} · ${next.voice}`);
}

if (!DRY && added.length) writeFileSync(reelsPath, JSON.stringify(reels, null, 2) + "\n");
console.log(added.length ? `\nQueued ${added.length}:\n${added.map((a) => "  " + a).join("\n")}` : "\nNothing queued.");
if (DRY) console.log("\n(dry run — nothing written)");
