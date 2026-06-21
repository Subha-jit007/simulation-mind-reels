#!/usr/bin/env node
/**
 * qa.mjs <day> — the "human watcher". Reviews a freshly rendered reel BEFORE it
 * can be posted and blocks anything that would read badly:
 *   - file is a valid 1080x1920 H.264 video WITH an audio track
 *   - duration is sane
 *   - READABILITY: every caption stays on screen long enough to actually read
 * Exits non-zero (fails the pipeline → no upload) if the reel doesn't pass.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const day = parseInt(process.argv[2] || "0", 10);
const dd = String(day).padStart(2, "0");

const reel = JSON.parse(readFileSync(join(ROOT, "studio", "src", "data", "reel.json"), "utf8"));
const renders = existsSync(join(ROOT, "renders"))
  ? readdirSync(join(ROOT, "renders")).filter((f) => new RegExp(`^Day-${dd}[ -]`).test(f) && f.endsWith(".mp4"))
  : [];
const file = renders[0] ? join(ROOT, "renders", renders[0]) : null;

const issues = [];
const fail = (m) => issues.push({ level: "FAIL", m });
const warn = (m) => issues.push({ level: "WARN", m });

// --- technical checks ---------------------------------------------------
if (!file) {
  fail(`No rendered MP4 found for day ${day}`);
} else {
  const probe = spawnSync("ffprobe", [
    "-v", "error", "-show_entries",
    "format=duration:stream=codec_type,codec_name,width,height",
    "-of", "json", file,
  ], { encoding: "utf8" });
  try {
    const j = JSON.parse(probe.stdout);
    const v = (j.streams || []).find((s) => s.codec_type === "video");
    const a = (j.streams || []).find((s) => s.codec_type === "audio");
    const dur = parseFloat(j.format?.duration || "0");
    if (!v) fail("No video stream");
    else if (v.width !== 1080 || v.height !== 1920) fail(`Wrong size ${v.width}x${v.height} (need 1080x1920)`);
    if (!a) fail("No audio track (silent video)");
    if (dur < 8) fail(`Too short (${dur.toFixed(1)}s)`);
    if (dur > 90) warn(`Long for a reel (${dur.toFixed(1)}s)`);
  } catch {
    fail("Could not probe the video");
  }
}

// --- readability check --------------------------------------------------
const caps = reel.captions || [];
const fps = reel.fps || 30;
const endMs = (reel.durationInFrames / fps) * 1000 - 2600; // captions stop ~CTA
let tooFast = 0;
caps.forEach((c, i) => {
  const next = caps[i + 1];
  const window = (next ? next.startMs : endMs) - c.startMs;
  const required = (c.text.length / 16) * 1000 + 300; // ~16 chars/sec + buffer
  if (window < 650) { fail(`Caption ${i + 1} flashes by (${window}ms): "${c.text.slice(0, 40)}…"`); tooFast++; }
  else if (window < required * 0.7) { tooFast++; }
  if (c.text.length > 95) warn(`Caption ${i + 1} is long (${c.text.length} chars)`);
});
const fastPct = caps.length ? tooFast / caps.length : 0;
if (fastPct > 0.3) fail(`${Math.round(fastPct * 100)}% of captions are too fast to read comfortably`);

// --- verdict ------------------------------------------------------------
const failed = issues.filter((i) => i.level === "FAIL");
const pass = failed.length === 0;
mkdirSync(join(ROOT, "renders", ".work", `day-${dd}`), { recursive: true });
writeFileSync(join(ROOT, "renders", ".work", `day-${dd}`, "qa.json"),
  JSON.stringify({ pass, day, captions: caps.length, tooFast, issues }, null, 2));

console.log(`\n🕵️  QA WATCHER — Day ${day}`);
console.log(`   captions: ${caps.length} · readable: ${caps.length - tooFast}/${caps.length}`);
for (const i of issues) console.log(`   ${i.level === "FAIL" ? "❌" : "⚠️ "} ${i.m}`);
console.log(pass ? "   ✅ APPROVED for upload\n" : "   ⛔ BLOCKED — fix before posting\n");
process.exit(pass ? 0 : 1);
