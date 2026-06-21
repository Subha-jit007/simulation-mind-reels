#!/usr/bin/env node
/**
 * build_reel.mjs <dayNumber>
 *
 * One command -> one finished, ready-to-upload reel.
 *  1. reads content/reels.json for the day
 *  2. edge-tts  -> deep serious voiceover (vo.mp3) + word timings (vo.vtt)
 *  3. parses vtt -> kinetic caption segments, computes exact duration
 *  4. writes studio/src/data/reel.json
 *  5. Remotion renders the silent 9:16 cinematic video
 *  6. ffmpeg synthesizes a dark ambient drone + muxes voice+music
 *  -> renders/Day-NN <slug>.mp4
 *
 * No API keys. 100% offline except edge-tts (free Microsoft neural voices).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STUDIO = join(ROOT, "studio");
const FPS = 30;
const W = 1080;
const H = 1920;
// portable python launcher: `py` on Windows, `python3` in CI/Linux (override with $PYTHON)
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "py" : "python3");

const day = parseInt(process.argv[2] || "1", 10);
if (!day) {
  console.error("Usage: node scripts/build_reel.mjs <dayNumber>");
  process.exit(1);
}

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} failed (exit ${r.status})`);
  }
}
function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || ""}`);
  return r.stdout.trim();
}

// ---- 1. load content ----------------------------------------------------
const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
const item = reels.find((r) => r.day === day);
if (!item) throw new Error(`No reel found for day ${day} in content/reels.json`);
log(`Day ${day}: "${item.title}"  (voice: ${item.voice}, palette: ${item.palette})`);

const work = join(ROOT, "renders", ".work", `day-${String(day).padStart(2, "0")}`);
mkdirSync(work, { recursive: true });
mkdirSync(join(STUDIO, "out"), { recursive: true });

// ---- 2. voiceover (edge-tts) -------------------------------------------
const narration = item.script.trim();
const txtFile = join(work, "narration.txt");
writeFileSync(txtFile, narration, "utf8");
const voMp3 = join(work, "vo.mp3");
const voVtt = join(work, "vo.vtt");
log("Generating deep voiceover with edge-tts…");
run(PYTHON, [
  "-m", "edge_tts",
  "--voice", item.voice,
  "--file", txtFile,
  // use =VALUE form so argparse doesn't treat the leading "-" as a new flag.
  // uniform slower rate (-12%) = more reading time + a more serious cadence.
  `--rate=-12%`,
  `--pitch=${item.pitch || "-6Hz"}`,
  "--write-media", voMp3,
  "--write-subtitles", voVtt,
]);

// ---- 3. parse vtt -> caption segments ----------------------------------
function tsToMs(ts) {
  // edge-tts writes SRT-style timestamps with a comma decimal: 00:00:00,100
  const m = ts.trim().match(/(\d+):(\d+):(\d+)[.,](\d+)/);
  if (!m) return 0;
  return (+m[1]) * 3600000 + (+m[2]) * 60000 + (+m[3]) * 1000 + (+m[4]);
}
function parseVtt(text) {
  const cues = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    const tline = lines.find((l) => l.includes("-->"));
    if (!tline) continue;
    const [a, b] = tline.split("-->");
    const txt = lines.slice(lines.indexOf(tline) + 1).join(" ").trim();
    if (!txt) continue;
    cues.push({ start: tsToMs(a), end: tsToMs(b), text: txt });
  }
  return cues;
}
// edge-tts gives sentence-level cues; expand to per-word timings by linear interpolation
function wordsFromCues(cues) {
  const words = [];
  for (const c of cues) {
    const toks = c.text.split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const dur = Math.max(c.end - c.start, toks.length * 110);
    for (let j = 0; j < toks.length; j++) {
      words.push({
        text: toks[j],
        startMs: Math.round(c.start + (dur * j) / toks.length),
        endMs: Math.round(c.start + (dur * (j + 1)) / toks.length),
      });
    }
  }
  return words;
}
// Group words into SENTENCE-level captions so each line stays on screen long
// enough to actually read. Only split a sentence at a clause once it gets long.
function groupWords(words) {
  const segs = [];
  let cur = null;
  const flush = () => { if (cur) { segs.push({ text: cur.text, startMs: cur.startMs, endMs: cur.endMs }); cur = null; } };
  for (const w of words) {
    if (!cur) cur = { text: w.text, startMs: w.startMs, endMs: w.endMs, n: 1 };
    else { cur.text += " " + w.text; cur.endMs = w.endMs; cur.n++; }
    const endsSentence = /[.?!]$/.test(cur.text);
    const longClause = /[,;:—–]$/.test(cur.text) && cur.text.length >= 58;
    if (endsSentence || longClause || cur.text.length >= 92) flush();
  }
  flush();
  return segs;
}
const cues = parseVtt(readFileSync(voVtt, "utf8"));
const captions = groupWords(wordsFromCues(cues));
if (!captions.length) throw new Error("No captions parsed from VTT");

const voDurMs = capture("ffprobe", [
  "-v", "error", "-show_entries", "format=duration",
  "-of", "default=noprint_wrappers=1:nokey=1", voMp3,
]);
const voDurSec = parseFloat(voDurMs);
const tailSec = 2.8; // breathing room for the closing CTA
const durationInFrames = Math.round((voDurSec + tailSec) * FPS);
log(`Voice ${voDurSec.toFixed(1)}s · ${captions.length} caption lines · ${durationInFrames} frames`);

// ---- 4. write studio data ----------------------------------------------
const reelData = {
  id: `day-${String(day).padStart(2, "0")}`,
  day,
  kicker: item.kicker || `SIMULATION · ${String(day).padStart(2, "0")}`,
  title: item.title,
  fps: FPS, width: W, height: H,
  durationInFrames,
  palette: item.palette || "void",
  voice: item.voice,
  cta: item.cta || "Follow for the questions that don't let you sleep.",
  captions,
};
// optional storytelling scenes (Canva images) for hero days: content/scenes/day-NN.json
const scenesPath = join(ROOT, "content", "scenes", `day-${String(day).padStart(2, "0")}.json`);
if (existsSync(scenesPath)) {
  reelData.scenes = JSON.parse(readFileSync(scenesPath, "utf8"));
  log(`Storytelling scenes: ${reelData.scenes.length}`);
}
writeFileSync(join(STUDIO, "src", "data", "reel.json"), JSON.stringify(reelData, null, 2));

// ---- 5. Remotion render (silent video) ---------------------------------
// Render to a RELATIVE path inside studio/ — the absolute vault path contains a
// space ("ig contetnt") which shell:true would split. mux reads the absolute path.
const silentRel = "out/silent.mp4";
const silent = join(STUDIO, "out", "silent.mp4");
log("Rendering cinematic video with Remotion…");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
run(npx, ["remotion", "render", "src/index.ts", "Reel", silentRel, "--log=error"], {
  cwd: STUDIO, shell: true,
});

// ---- 6. cinematic dark-ambient drone -----------------------------------
const totalSec = durationInFrames / FPS;
const music = join(work, "music.mp3");
const fadeOut = Math.max(0, totalSec - 4);
log("Synthesizing dark ambient drone…");
const droneFilter =
  "[0:a]volume=0.5[a];[1:a]volume=0.30[b];[2:a]volume=0.20[c];" +
  "[3:a]lowpass=f=380,volume=0.55[d];" +
  "[a][b][c][d]amix=inputs=4:normalize=0[mx];" +
  "[mx]tremolo=f=0.1:d=0.4,lowpass=f=520," +
  "aecho=0.8:0.7:1100|1700:0.45|0.30,volume=2.3,alimiter=limit=0.9," +
  `afade=t=in:d=4,afade=t=out:st=${fadeOut}:d=4[out]`;
run("ffmpeg", [
  "-y",
  "-f", "lavfi", "-i", "sine=frequency=55:sample_rate=44100",
  "-f", "lavfi", "-i", "sine=frequency=82.41:sample_rate=44100",
  "-f", "lavfi", "-i", "sine=frequency=110:sample_rate=44100",
  "-f", "lavfi", "-i", "anoisesrc=color=brown:sample_rate=44100:amplitude=0.18",
  "-filter_complex", droneFilter,
  "-map", "[out]", "-t", String(totalSec),
  "-c:a", "libmp3lame", "-q:a", "4", music,
]);

// ---- 7. mux voice + music + video --------------------------------------
mkdirSync(join(ROOT, "renders"), { recursive: true });
const outName = `Day-${String(day).padStart(2, "0")}-${slug(item.title)}.mp4`;
const outFile = join(ROOT, "renders", outName);
log("Mixing audio and muxing final reel…");
const muxFilter =
  "[1:a]aresample=44100,highpass=f=80," +
  "acompressor=threshold=0.06:ratio=3:attack=10:release=220," +
  "aecho=0.85:0.5:55:0.12,apad,volume=1.0[vo];" +
  "[2:a]aresample=44100,volume=0.16[mu];" +
  "[vo][mu]amix=inputs=2:duration=longest:normalize=0:dropout_transition=3[mix];" +
  "[mix]alimiter=limit=0.95[a]";
run("ffmpeg", [
  "-y",
  "-i", silent,
  "-i", voMp3,
  "-i", music,
  "-filter_complex", muxFilter,
  "-map", "0:v", "-map", "[a]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
  "-t", String(totalSec),
  outFile,
]);

log(`\x1b[32m✓ DONE\x1b[0m  renders/${outName}`);
console.log(`\nCaption to post:\n${item.caption}\n\n${(item.hashtags || []).join(" ")}`);

// QA watcher review (non-fatal locally; the cloud workflow treats it as a hard gate)
spawnSync(process.execPath, [join(__dirname, "qa.mjs"), String(day)], { stdio: "inherit" });
