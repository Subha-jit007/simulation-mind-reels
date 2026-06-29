#!/usr/bin/env node
/**
 * build_reel_trend.mjs <day> [--assets <dir>] [--vo]
 *
 * The COLORFUL TREND style (replaces the dark moody look for the channel).
 *   - punchy short captions derived from the day's content (or item.beats)
 *   - one VIBRANT psychedelic image per beat, sourced 3 ways:
 *       provided  → --assets <dir> (or content/scenes/day-NN images you drop in)
 *       made      → Pollinations flux (free, unlimited, headless-cloud safe)
 *       found     → Pexels (PEXELS_API_KEY) → colorful gradient fallback
 *   - Ken-Burns motion + crossfades, bright cycling-color captions that
 *     fade in / drift out, warm (non-doom, non-cartoon) pad underneath.
 *   - pure ffmpeg (no Remotion / no Chrome) → runs identically local + CI.
 *
 * Output: renders/Day-NN-<slug>.mp4   then runs the qa.mjs gate.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STUDIO = join(ROOT, "studio");
const FPS = 30, W = 1080, H = 1920;
const DUR = 4.0;                 // seconds per beat
const FR = Math.round(DUR * FPS); // frames per beat
const XF = 0.6;                  // crossfade seconds
const STEP = DUR - XF;           // global time advance per beat

const args = process.argv.slice(2);
const day = parseInt(args[0] || "1", 10);
if (!day) { console.error("Usage: build_reel_trend.mjs <day> [--assets <dir>] [--vo]"); process.exit(1); }
const assetsDir = args.includes("--assets") ? args[args.indexOf("--assets") + 1] : process.env.ASSET_DIR || null;
const useVO = args.includes("--vo") || process.env.WITH_VO === "1";
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "py" : "python3");

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
function run(cmd, a, o = {}) { const r = spawnSync(cmd, a, { stdio: "inherit", ...o }); if (r.status !== 0) throw new Error(`${cmd} failed (exit ${r.status})`); }
function capture(cmd, a, o = {}) { const r = spawnSync(cmd, a, { encoding: "utf8", ...o }); if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || ""}`); return r.stdout.trim(); }

// ---- 1. content + punchy beats -----------------------------------------
const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
const item = reels.find((r) => r.day === day);
if (!item) throw new Error(`No reel for day ${day}`);

function wrap(s, max = 26) {
  if (s.length <= max) return s;
  const words = s.split(" "); let l1 = "", l2 = "";
  for (const w of words) { if ((l1 + " " + w).trim().length <= max && !l2) l1 = (l1 + " " + w).trim(); else l2 = (l2 + " " + w).trim(); }
  return l2 ? l1 + "\n" + l2 : l1;
}
function deriveBeats() {
  if (Array.isArray(item.beats) && item.beats.length) return item.beats.slice(0, 10);
  const beats = [item.title.replace(/\s+/g, " ").trim()];
  const sents = (item.script || item.idea || "").split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  for (const s of sents) {
    const clauses = s.length <= 48 ? [s] : s.split(/\s*[,;:—–]\s*/).map((c) => c.trim()).filter(Boolean);
    for (let c of clauses) {
      c = c.replace(/[.,;:—–]+$/, "").trim();
      if (c.length < 3) continue;
      if (c.length > 60) c = c.slice(0, 57).replace(/\s+\S*$/, "") ;   // trim at word boundary
      beats.push(c);
    }
  }
  // keep 6..9 beats so the reel stays a tight 22-34s
  return beats.slice(0, 9);
}
const beats = deriveBeats();
const N = beats.length;
log(`Day ${day} "${item.title}" — TREND style · ${N} beats · ${useVO ? "with VO" : "music only"}`);

const dd = String(day).padStart(2, "0");
const work = join(ROOT, "renders", ".work", `day-${dd}-trend`);
mkdirSync(work, { recursive: true });
mkdirSync(join(STUDIO, "src", "data"), { recursive: true });

// font: bundled Anton (consistent local + CI); fall back to a system heavy font
const fontCandidates = [process.env.TREND_FONT, join(ROOT, "assets", "fonts", "Anton-Regular.ttf"),
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/ariblk.ttf"].filter(Boolean);
const fontSrc = fontCandidates.find((f) => existsSync(f));
if (!fontSrc) throw new Error("no usable font found");
copyFileSync(fontSrc, join(work, "font.ttf"));

// ---- 2. assets: provided → made → found → gradient ---------------------
async function dl(url, opts = {}) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 90000);
  try { const res = await fetch(url, { ...opts, signal: ctrl.signal }); if (!res.ok) throw new Error("HTTP " + res.status);
    const b = Buffer.from(await res.arrayBuffer()); if (b.length < 3000) throw new Error("empty"); return b;
  } finally { clearTimeout(to); }
}
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const PEX = ["psychedelic colorful", "neon abstract", "colorful galaxy", "vibrant paint", "rainbow smoke", "colorful surreal", "holographic"];
async function pexels(q) {
  if (!PEXELS_KEY) return null;
  try { const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=15`, { headers: { Authorization: PEXELS_KEY } });
    const j = await r.json(); const p = j.photos || []; if (!p.length) return null;
    const pick = p[Math.floor(Math.random() * p.length)]; return await dl(pick.src.portrait || pick.src.large2x);
  } catch { return null; }
}
const STYLE = "vibrant psychedelic dreamscape, ultra colorful, surreal trippy, saturated neon, cosmic, fluid art, high detail, no text, no words, no watermark, vertical 9:16, depicting:";
function gradient(path, i) {
  const cols = ["0xFF4FA3", "0x36E0FF", "0xB6FF3C", "0xC77DFF", "0xFFA94D"];
  const c0 = cols[i % cols.length], c1 = cols[(i + 2) % cols.length];
  run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i",
    `gradients=s=1080x1920:c0=${c0}:c1=${c1}:x0=0:y0=0:x1=1080:y1=1920:d=1`, "-frames:v", "1", path]);
}
function providedImages(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort()
    .map((f) => join(dir, f));
}
async function getImage(i, providedList) {
  const out = join(work, `img${i}.jpg`);
  // provided
  if (providedList.length) {
    const src = providedList[i % providedList.length];
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", src,
      "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-frames:v", "1", "-q:v", "3", out]);
    return { out, src: "provided" };
  }
  // made (Pollinations)
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(`${STYLE} ${beats[i].replace(/\n/g, " ")}`)}?width=768&height=1344&nologo=true&model=flux&seed=${day * 100 + i}`;
  let buf = null, src = "made";
  for (let a = 0; a < 2 && !buf; a++) { try { buf = await dl(url); } catch {} }
  if (!buf) { buf = await pexels(PEX[(day + i) % PEX.length]); src = "found"; }
  const tmp = join(work, `img${i}.src`);
  if (buf) {
    writeFileSync(tmp, buf);
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp,
      "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-frames:v", "1", "-q:v", "3", out]);
    if (r.status === 0) return { out, src };
  }
  gradient(out, i); return { out, src: "gradient" };
}

// ---- 3. per-beat clips (Ken Burns + colorful caption) -------------------
const COLS = ["0xFFE14D", "0x4DE1FF", "0xB6FF4D", "0xFF6FB5", "0xC77DFF", "0xFFA94D", "0x5CFFD6", "0xFF5C7A", "0xFFD93C"];
const YEXPR = "h*0.72+40*(1-min(t/0.6\\,1))-26*max(t-3.4\\,0)/0.6";
const AEXPR = "if(lt(t\\,0.5)\\,t/0.5\\,if(lt(t\\,3.5)\\,1\\,max(0\\,(4.0-t)/0.5)))";
function fontSize(text) { const len = Math.max(...text.split("\n").map((l) => l.length)); return len <= 12 ? 92 : len <= 18 ? 80 : len <= 26 ? 68 : 58; }

const provided = providedImages(assetsDir);
if (provided.length) log(`Using ${provided.length} PROVIDED assets from ${assetsDir}`);

for (let i = 0; i < N; i++) {
  const text = wrap(beats[i].replace(/\n/g, " "), 24);
  writeFileSync(join(work, `cap${i}.txt`), text, "utf8");
  const { out, src } = await getImage(i, provided);
  const Z = i % 2 === 0 ? "min(zoom+0.0011\\,1.20)" : "if(lte(on\\,1)\\,1.20\\,max(zoom-0.0011\\,1.0))";
  const fc = COLS[i % COLS.length];
  const fs = fontSize(text);
  const filter =
    `[0:v]scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,setsar=1,` +
    `eq=saturation=1.2:contrast=1.05,zoompan=z='${Z}':d=${FR}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=${FPS},` +
    `drawtext=fontfile=font.ttf:textfile=cap${i}.txt:fontsize=${fs}:fontcolor=${fc}:bordercolor=black:borderw=9:` +
    `shadowcolor=black@0.5:shadowx=3:shadowy=4:line_spacing=8:x=(w-text_w)/2:y='${YEXPR}':alpha='${AEXPR}',format=yuv420p[v]`;
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", out, "-filter_complex", filter,
    "-map", "[v]", "-frames:v", String(FR), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", `beat${i}.mp4`],
    { cwd: work });
  process.stdout.write(`  beat ${i + 1}/${N} ✓ (${src}) "${beats[i].replace(/\n/g, " ").slice(0, 30)}"\n`);
}

// ---- 4. crossfade chain ------------------------------------------------
const TRANS = ["fade", "smoothleft", "circleopen", "smoothright", "fade", "smoothup", "radial", "dissolve", "fade"];
const inArgs = []; for (let i = 0; i < N; i++) inArgs.push("-i", `beat${i}.mp4`);
let filt = `[0][1]xfade=transition=${TRANS[0]}:duration=${XF}:offset=${STEP.toFixed(2)}[x1]`;
for (let k = 2; k < N; k++) filt += `;[x${k - 1}][${k}]xfade=transition=${TRANS[(k - 1) % TRANS.length]}:duration=${XF}:offset=${(STEP * k).toFixed(2)}[x${k}]`;
const vlabel = N === 1 ? "0" : `x${N - 1}`;
log("compositing crossfades…");
run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...inArgs, "-filter_complex",
  filt.replace(`[${vlabel}]`, "[vout]") + (N === 1 ? "" : ""), "-map", N === 1 ? "0:v" : "[vout]",
  "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "combined.mp4"], { cwd: work });

const total = +(N * DUR - (N - 1) * XF).toFixed(2);

// ---- 5. warm uplifting pad (NOT doom, NOT cartoon) + optional VO --------
const padFilter =
  "sine=f=130.81:r=44100[c3];sine=f=164.81:r=44100[e3];sine=f=196.00:r=44100[g3];sine=f=261.63:r=44100[c4];sine=f=65.41:r=44100[c2];" +
  "[c3][e3][g3][c4][c2]amix=inputs=5:weights=0.9 0.8 0.8 0.4 0.7:normalize=0[m];" +
  `[m]volume=0.16,tremolo=f=0.18:d=0.35,lowpass=f=2100,highpass=f=45,aecho=0.8:0.5:140:0.3,afade=t=in:st=0:d=2.5,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[a]`;
run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-filter_complex", padFilter,
  "-map", "[a]", "-t", String(total), "-ar", "44100", "-ac", "2", "-c:a", "aac", "-b:a", "192k", join(work, "pad.m4a")]);

let voPath = null;
if (useVO) {
  const txt = join(work, "vo.txt"); writeFileSync(txt, beats.join(". ").replace(/\n/g, " "), "utf8");
  voPath = join(work, "vo.mp3");
  log("deep VO via edge-tts…");
  run(PYTHON, ["-m", "edge_tts", "--voice", item.voice || "en-US-GuyNeural", "--file", txt, "--rate=-10%", `--pitch=${item.pitch || "-4Hz"}`, "--write-media", voPath]);
}

// ---- 6. mux ------------------------------------------------------------
mkdirSync(join(ROOT, "renders"), { recursive: true });
const outName = `Day-${dd}-${slug(item.title)}.mp4`;
const outFile = join(ROOT, "renders", outName);
if (voPath) {
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", join(work, "combined.mp4"), "-i", voPath, "-i", join(work, "pad.m4a"),
    "-filter_complex", "[1:a]aresample=44100,highpass=f=80,acompressor=threshold=0.06:ratio=3,apad[vo];[2:a]volume=0.6[mu];[vo][mu]amix=inputs=2:duration=first:normalize=0[a]",
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outFile]);
} else {
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", join(work, "combined.mp4"), "-i", join(work, "pad.m4a"),
    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outFile]);
}

// ---- 7. reel.json for the QA gate + caption to post --------------------
const captions = beats.map((b, i) => ({ text: b.replace(/\n/g, " "), startMs: Math.round(STEP * i * 1000) + 500, endMs: Math.round((STEP * i + 3.2) * 1000) }));
writeFileSync(join(STUDIO, "src", "data", "reel.json"), JSON.stringify({
  id: `day-${dd}`, day, fps: FPS, width: W, height: H, durationInFrames: Math.round(total * FPS), style: "trend", captions,
}, null, 2));

log(`\x1b[32m✓ DONE\x1b[0m  renders/${outName}  (${total}s, ${N} beats)`);
console.log(`\nCaption to post:\n${item.caption || item.title}\n\n${(item.hashtags || []).join(" ")}`);
spawnSync(process.execPath, [join(__dirname, "qa.mjs"), String(day)], { stdio: "inherit" });
