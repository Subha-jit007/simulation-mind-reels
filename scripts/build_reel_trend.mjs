#!/usr/bin/env node
/**
 * build_reel_trend.mjs <day> [--assets <dir>] [--seconds N] [--no-vo]
 *
 * The channel's daily reel builder. Pure ffmpeg — no Chrome, no Remotion —
 * so it behaves identically on Subha's machine and on a GitHub runner.
 *
 * WHAT CHANGED (v2) and why, because every line of it is a fix for something
 * that was measurably hurting reach:
 *
 *  1. NO third-party stock. The old fallback searched Pexels for "psychedelic
 *     colorful" and published a rainbow glass pipe over the line "philosophers
 *     call it a zombie". Images now come from one art-directed motif bank
 *     (art.mjs) so a reel is one coherent world instead of nine unrelated
 *     photos. Fallback is a generated palette gradient, never someone's photo.
 *  2. VO DRIVES THE TIMING. Each beat gets its own edge-tts line, is measured,
 *     and its clip is cut to that length. Captions can no longer drift off the
 *     voice, and beats are non-metronomic for free.
 *  3. LENGTH IS A PARAMETER. --seconds / item.targetSeconds decides how much
 *     script survives, so the growth agent can tune length against watch-time
 *     instead of everything being a flat 31s.
 *  4. HARD CUTS, not 0.6s crossfades on every seam. Each beat opens on a
 *     scale-punch that settles, which reads as an actual edit.
 *  5. LOCKED TYPOGRAPHY inside Instagram's safe zone. No more random per-beat
 *     colour cycling; ivory body, palette accent on the hook, and a soft scrim
 *     so text stays legible without a cheap 9px outline.
 *  6. LOOP CLOSE. The last beat returns to the first image so the reel loops
 *     seamlessly — replays are reach.
 *
 * Output: renders/Day-NN-<slug>.mp4, then the qa.mjs gate.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { promptFor, paletteOf, IVORY } from "./art.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STUDIO = join(ROOT, "studio");
const FPS = 30, W = 1080, H = 1920;

// Instagram's own UI eats the edges of a reel. Keep every pixel that matters
// inside this box or the caption ends up under the like button.
const SAFE_TOP = 200, SAFE_BOTTOM = 430;
const TEXT_BASE = H - SAFE_BOTTOM - 90; // baseline region for the caption block

const args = process.argv.slice(2);
const day = parseInt(args[0] || "1", 10);
if (!day) { console.error("Usage: build_reel_trend.mjs <day> [--assets <dir>] [--seconds N] [--no-vo]"); process.exit(1); }
const argVal = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
const assetsDir = argVal("--assets") || process.env.ASSET_DIR || null;
const useVO = !args.includes("--no-vo") && process.env.WITH_VO !== "0";
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "py" : "python3");

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
function run(cmd, a, o = {}) {
  const r = spawnSync(cmd, a, { stdio: "inherit", ...o });
  if (r.status !== 0) throw new Error(`${cmd} failed (exit ${r.status})`);
}
function probeDur(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const d = parseFloat((r.stdout || "").trim());
  return Number.isFinite(d) ? d : 0;
}

// ---- 1. content, length budget, beats ----------------------------------
const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
const item = reels.find((r) => r.day === day);
if (!item) throw new Error(`No reel for day ${day}`);
const pal = paletteOf(item.palette);

// The growth agent writes targetSeconds per day once it has watch-time data.
// Until then 16s: long enough for one idea, short enough to loop on a cold
// account. CLI flag wins so a hero build can override.
const targetSeconds = Number(argVal("--seconds") || item.targetSeconds || process.env.TARGET_SECONDS || 16);

function wrap(s, max) {
  const words = s.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3).join("\n");
}

/**
 * Beats = the hook, then as much of the script as fits the length budget.
 * ~2.4 words/sec at edge-tts rate -6%, plus ~0.45s of air per beat.
 */
const secondsFor = (text) => text.split(/\s+/).length / 2.4 + 0.45;

/** Closing beat. A reel that ends mid-thought has nothing to loop back into. */
function closingLine() {
  const cta = (item.cta || "").replace(/\s+/g, " ").trim();
  if (cta && cta.length <= 46) return cta;
  return item.title.replace(/\s+/g, " ").trim();
}

function deriveBeats() {
  if (Array.isArray(item.beats) && item.beats.length) return item.beats.slice(0, 12);

  const hook = item.title.replace(/\s+/g, " ").trim();
  const close = closingLine();

  // Split into clauses, then MERGE the runts. A comma list like "your life,
  // your love, your pain" would otherwise become three two-word beats, and the
  // reel would end on the fragment "your life".
  const raw = [];
  for (const s of (item.script || item.idea || "").split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean)) {
    const parts = s.length <= 60 ? [s] : s.split(/\s*[;:—–]\s*|,\s+/).map((c) => c.trim()).filter(Boolean);
    for (let c of parts) {
      c = c.replace(/[.,;:—–]+$/, "").trim();
      if (c.length < 4) continue;
      // Anything too short to stand alone folds into the previous beat.
      if (raw.length && (c.length < 20 || raw[raw.length - 1].length < 20)) {
        raw[raw.length - 1] = `${raw[raw.length - 1]}, ${c}`;
      } else {
        raw.push(c);
      }
    }
  }

  // Reserve room for the hook and the closing line before spending on body.
  let budget = targetSeconds - secondsFor(hook) - 0.3 - secondsFor(close);
  const body = [];
  for (const c of raw) {
    const cost = secondsFor(c);
    if (budget - cost < 0) break;
    budget -= cost;
    body.push(c);
    if (body.length >= 9) break;
  }
  return [hook, ...body, close];
}
const beats = deriveBeats();
const N = beats.length;
log(`Day ${day} "${item.title}" — ${N} beats · target ${targetSeconds}s · palette ${item.palette} · ${useVO ? "VO" : "music only"}`);

const dd = String(day).padStart(2, "0");
const work = join(ROOT, "renders", ".work", `day-${dd}-trend`);
mkdirSync(work, { recursive: true });
mkdirSync(join(STUDIO, "src", "data"), { recursive: true });

const fontCandidates = [process.env.TREND_FONT, join(ROOT, "assets", "fonts", "Anton-Regular.ttf"),
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/ariblk.ttf"].filter(Boolean);
const fontSrc = fontCandidates.find((f) => existsSync(f));
if (!fontSrc) throw new Error("no usable font found");
copyFileSync(fontSrc, join(work, "font.ttf"));

// ---- 2. voice first, so the pictures can be cut to it -------------------
const voFiles = [];
const durations = [];
if (useVO) {
  log("voicing beats (edge-tts)…");
  for (let i = 0; i < N; i++) {
    const txt = join(work, `vo${i}.txt`);
    writeFileSync(txt, beats[i].replace(/\n/g, " "), "utf8");
    const mp3 = join(work, `vo${i}.mp3`);
    run(PYTHON, ["-m", "edge_tts", "--voice", item.voice || "en-US-GuyNeural", "--file", txt,
      `--rate=${item.rate || "-6%"}`, `--pitch=${item.pitch || "-4Hz"}`, "--write-media", mp3]);
    voFiles.push(mp3);
    // A held beat reads as confidence; a clipped one reads as a glitch.
    const d = probeDur(mp3);
    durations.push(Math.max(1.5, +(d + (i === 0 ? 0.75 : 0.45)).toFixed(2)));
  }
} else {
  for (let i = 0; i < N; i++) durations.push(i === 0 ? 2.4 : 2.0);
}
const starts = [];
let acc = 0;
for (const d of durations) { starts.push(+acc.toFixed(2)); acc += d; }
const total = +acc.toFixed(2);
log(`timeline: ${total}s  [${durations.join(", ")}]`);

// ---- 3. images: art-directed generation, palette gradient as fallback ---
async function dl(url) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length < 3000) throw new Error("empty");
    return b;
  } finally { clearTimeout(to); }
}
function gradient(path, i) {
  // Branded fallback. Never a stranger's photograph.
  const c0 = pal.accentHex.replace("#", "0x");
  const cols = ["0x2B1E5C", "0x0B2540", "0x3D1B4A", "0x14343C"];
  run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i",
    `gradients=s=1080x1920:c0=${c0}:c1=${cols[i % cols.length]}:x0=0:y0=0:x1=1080:y1=1920:d=1`,
    "-frames:v", "1", path]);
}
function fit(src, out) {
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf",
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-frames:v", "1", "-q:v", "2", out]);
}
const providedList = (assetsDir && existsSync(assetsDir))
  ? readdirSync(assetsDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort().map((f) => join(assetsDir, f))
  : [];
if (providedList.length) log(`using ${providedList.length} PROVIDED assets from ${assetsDir}`);

async function getImage(i) {
  const out = join(work, `img${i}.jpg`);
  if (existsSync(out) && process.env.REUSE_SCENES === "1") return { out, src: "cache" };

  if (providedList.length) { fit(providedList[i % providedList.length], out); return { out, src: "provided" }; }

  const prompt = promptFor(day, i, N, item.palette);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
    + `?width=768&height=1344&nologo=true&model=flux&seed=${day * 100 + i}`;
  for (let a = 0; a < 3; a++) {
    try {
      const buf = await dl(url);
      const tmp = join(work, `img${i}.src`);
      writeFileSync(tmp, buf);
      const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-vf",
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-frames:v", "1", "-q:v", "2", out]);
      if (r.status === 0) return { out, src: "made" };
    } catch { /* retry */ }
  }
  gradient(out, i);
  return { out, src: "gradient" };
}

// A soft bottom scrim, generated once. Keeps captions readable over a busy
// image without the cheap thick-outline look.
const scrim = join(work, "scrim.png");
run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=black:s=${W}x${H}`,
  "-vf", "format=yuva420p,geq=r=0:g=0:b=0:a='clip((Y-820)/620*170,0,170)'", "-frames:v", "1", scrim]);

// ---- 4. one clip per beat: punch-settle push + locked type --------------
function fontSize(text) {
  const longest = Math.max(...text.split("\n").map((l) => l.length));
  if (longest <= 14) return 92;
  if (longest <= 20) return 78;
  if (longest <= 27) return 66;
  return 56;
}

const images = [];
for (let i = 0; i < N; i++) {
  // Loop close: the final beat returns to the opening image.
  const isLast = i === N - 1 && N > 2;
  const { out, src } = isLast ? { out: images[0], src: "loop" } : await getImage(i);
  images.push(out);

  const D = durations[i];
  const FR = Math.round(D * FPS);
  const text = wrap(beats[i].replace(/\n/g, " "), i === 0 ? 18 : 24);
  writeFileSync(join(work, `cap${i}.txt`), text, "utf8");
  const fs = fontSize(text);
  const lines = text.split("\n").length;
  const yTop = TEXT_BASE - (lines - 1) * (fs + 10);

  // Push in or pull out, alternating, so consecutive cuts don't feel identical.
  // Each opens 6% hot and settles — that reads as an edit rather than a fade.
  // NOTE: zoompan has no `t`; progress must come from `on` (output frame).
  const settleFrames = Math.max(1, Math.round(0.45 * FPS));
  const P = `(on/${FR})`;
  const SETTLE = `min(on/${settleFrames}\\,1)`;
  const dir = i % 2 === 0 ? 1 : -1;
  const z = dir > 0
    ? `1.06+0.10*${P}-0.06*${SETTLE}`
    : `1.18-0.10*${P}+0.06*(1-${SETTLE})`;

  // Caption rises a few px and holds; alpha in fast, out only at the very end.
  const yExpr = `${yTop}-14*(1-min(t/0.32\\,1))`;
  const outStart = Math.max(0.2, D - 0.28);
  const aExpr = `if(lt(t\\,0.22)\\,t/0.22\\,if(lt(t\\,${outStart.toFixed(2)})\\,1\\,max(0\\,(${D.toFixed(2)}-t)/0.28)))`;
  const col = i === 0 ? pal.accentHex : IVORY;

  // Top progress bar: uses global time so it tracks the whole reel, not the clip.
  const barW = `iw*(t+${starts[i].toFixed(2)})/${total.toFixed(2)}`;

  const filter =
    `[0:v]scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,setsar=1,${pal.grade},` +
    `zoompan=z='${z}':d=${FR}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}[bg];` +
    `[bg][1:v]overlay=0:0[sc];` +
    `[sc]drawbox=x=0:y=0:w='${barW}':h=7:color=${pal.accentHex}@0.95:t=fill,` +
    `drawtext=fontfile=font.ttf:text='@__.advaita_':fontsize=30:fontcolor=${IVORY}@0.62:x=48:y=${SAFE_TOP - 60},` +
    // No "/51" — the growth agent writes new days past the original 51, so a
    // fixed denominator would start lying.
    `drawtext=fontfile=font.ttf:text='DAY ${day}':fontsize=30:fontcolor=${IVORY}@0.72:x=w-text_w-48:y=${SAFE_TOP - 60},` +
    `drawtext=fontfile=font.ttf:textfile=cap${i}.txt:fontsize=${fs}:fontcolor=${col}:` +
    `bordercolor=black@0.55:borderw=4:shadowcolor=black@0.45:shadowx=2:shadowy=3:line_spacing=10:` +
    `x=(w-text_w)/2:y='${yExpr}':alpha='${aExpr}',format=yuv420p[v]`;

  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-i", out, "-i", scrim,
    "-filter_complex", filter, "-map", "[v]", "-frames:v", String(FR), "-r", String(FPS),
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", `beat${i}.mp4`], { cwd: work });
  process.stdout.write(`  beat ${i + 1}/${N} ✓ ${D}s (${src}) "${beats[i].slice(0, 34)}"\n`);
}

// ---- 5. hard-cut assembly ----------------------------------------------
log("cutting…");
writeFileSync(join(work, "list.txt"), beats.map((_, i) => `file 'beat${i}.mp4'`).join("\n") + "\n");
run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
  "-i", "list.txt", "-c", "copy", "combined.mp4"], { cwd: work });

// ---- 6. score: warm, wide, serious. Never cartoon. ---------------------
const padFilter =
  "sine=f=130.81:r=44100[c3];sine=f=164.81:r=44100[e3];sine=f=196.00:r=44100[g3];" +
  "sine=f=261.63:r=44100[c4];sine=f=65.41:r=44100[c2];" +
  "[c3][e3][g3][c4][c2]amix=inputs=5:weights=0.9 0.8 0.8 0.4 0.7:normalize=0[m];" +
  `[m]volume=0.15,tremolo=f=0.18:d=0.32,lowpass=f=2100,highpass=f=45,aecho=0.8:0.5:140:0.3,` +
  `afade=t=in:st=0:d=2.2,afade=t=out:st=${Math.max(0, total - 2.2).toFixed(2)}:d=2.2[a]`;
run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-filter_complex", padFilter,
  "-map", "[a]", "-t", String(total), "-ar", "44100", "-ac", "2", "-c:a", "aac", "-b:a", "192k", join(work, "pad.m4a")]);

// VO track: each line padded out to its own beat's length, then concatenated.
// This is what keeps the voice locked to the captions with no SRT parsing.
let voTrack = null;
if (useVO) {
  for (let i = 0; i < N; i++) {
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", voFiles[i], "-af",
      `aresample=44100,highpass=f=80,acompressor=threshold=0.06:ratio=3,apad=whole_dur=${durations[i]}`,
      "-t", String(durations[i]), "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", join(work, `vp${i}.wav`)]);
  }
  writeFileSync(join(work, "volist.txt"), beats.map((_, i) => `file 'vp${i}.wav'`).join("\n") + "\n");
  run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "volist.txt",
    "-c", "copy", "votrack.wav"], { cwd: work });
  voTrack = join(work, "votrack.wav");
}

// ---- 7. mux ------------------------------------------------------------
mkdirSync(join(ROOT, "renders"), { recursive: true });
const outName = `Day-${dd}-${slug(item.title)}.mp4`;
const outFile = join(ROOT, "renders", outName);
if (voTrack) {
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
    "-i", join(work, "combined.mp4"), "-i", voTrack, "-i", join(work, "pad.m4a"),
    "-filter_complex", "[1:a]volume=1.0[vo];[2:a]volume=0.5[mu];[vo][mu]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]",
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart", outFile]);
} else {
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
    "-i", join(work, "combined.mp4"), "-i", join(work, "pad.m4a"),
    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart", outFile]);
}

// ---- 8. hand the QA gate its timing map --------------------------------
const captions = beats.map((b, i) => ({
  text: b.replace(/\n/g, " "),
  startMs: Math.round(starts[i] * 1000) + 200,
  endMs: Math.round((starts[i] + durations[i]) * 1000) - 200,
}));
writeFileSync(join(STUDIO, "src", "data", "reel.json"), JSON.stringify({
  id: `day-${dd}`, day, fps: FPS, width: W, height: H,
  durationInFrames: Math.round(total * FPS), style: "trend-v2",
  targetSeconds, palette: item.palette, voice: item.voice, captions,
}, null, 2));

// ---- 9. experiment record ----------------------------------------------
// The growth agent can only learn from a choice if it knows the choice was
// made. Every render appends what it actually did, so reach and watch-time
// can later be attributed back to length, palette, voice and beat count.
const manifestPath = join(ROOT, "content", "renders.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
const record = {
  day, renderedAt: new Date().toISOString(), style: "trend-v2",
  seconds: total, targetSeconds, beats: N, palette: item.palette,
  voice: item.voice, rate: item.rate || "-6%", pitch: item.pitch || "-4Hz",
  hook: beats[0], vo: useVO, source: item.source || "original",
};
const at = manifest.findIndex((r) => r.day === day);
if (at >= 0) manifest[at] = record; else manifest.push(record);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

log(`\x1b[32m✓ DONE\x1b[0m  renders/${outName}  (${total}s, ${N} beats)`);
console.log(`\nCaption to post:\n${item.caption || item.title}\n\n${(item.hashtags || []).join(" ")}`);
spawnSync(process.execPath, [join(__dirname, "qa.mjs"), String(day)], { stdio: "inherit" });
