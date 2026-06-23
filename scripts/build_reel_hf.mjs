#!/usr/bin/env node
/**
 * build_reel_hf.mjs <dayNumber>   — PREMIUM / skill-driven render path
 *
 * Same spine as build_reel.mjs (deep edge-tts VO + word-timed captions + cinematic
 * Pollinations scenes + dark-ambient drone + yuv420p/faststart mux) BUT the video is
 * authored as a HyperFrames composition (HTML/GSAP) and rendered with `npx hyperframes
 * render`, applying the `video-editing` editorial grammar: engineered hook, kinetic
 * captions, eased Ken-Burns scenes with crossfades, persistent simulation-terminal chrome.
 *
 * Designed to run in WSL2 Ubuntu (Linux x64 — the supported HyperFrames platform).
 * Heavy frame IO happens on the Linux-native FS (os.tmpdir()); only the final MP4 is
 * written back to the repo's renders/ (on /mnt/e). Audio identity is preserved: deep
 * serious VO + cinematic dark-ambient drone (see audio-style rule). HF render stays
 * SILENT; audio is muxed afterward exactly like the Remotion path.
 *
 * Env: QUALITY=draft|standard|high (default standard) · FORCE_VO=1 to regen VO ·
 *      NO_SCENES=1 cosmic-only · PEXELS_API_KEY for scene fallback.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir, homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FPS = 30;
const W = 1080;
const H = 1920;
const QUALITY = process.env.QUALITY || "standard";
const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "py" : "python3");

const day = parseInt(process.argv[2] || "0", 10);
if (!day) { console.error("Usage: node scripts/build_reel_hf.mjs <dayNumber>"); process.exit(1); }

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed (exit ${r.status})`);
}
function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || ""}`);
  return r.stdout.trim();
}

// ---- 1. content ---------------------------------------------------------
const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
const item = reels.find((r) => r.day === day);
if (!item) throw new Error(`No reel for day ${day} in content/reels.json`);
if (!item.script || !item.script.trim()) throw new Error(`Day ${day} has no script yet`);
log(`Day ${day}: "${item.title}"  (voice ${item.voice}, HyperFrames · ${QUALITY})`);

const DD = String(day).padStart(2, "0");
const work = join(ROOT, "renders", ".work", `day-${DD}`);
mkdirSync(work, { recursive: true });

// ---- 2. voiceover (reuse cache for fast iteration) ----------------------
const voMp3 = join(work, "vo.mp3");
const voVtt = join(work, "vo.vtt");
if (process.env.FORCE_VO === "1" || !existsSync(voMp3) || !existsSync(voVtt)) {
  const txtFile = join(work, "narration.txt");
  writeFileSync(txtFile, item.script.trim(), "utf8");
  log("Generating deep voiceover with edge-tts…");
  run(PYTHON, ["-m", "edge_tts", "--voice", item.voice, "--file", txtFile,
    `--rate=-12%`, `--pitch=${item.pitch || "-6Hz"}`,
    "--write-media", voMp3, "--write-subtitles", voVtt]);
} else { log("Reusing cached voiceover (FORCE_VO=1 to regenerate)"); }

// ---- 3. captions --------------------------------------------------------
function tsToMs(ts) {
  const m = ts.trim().match(/(\d+):(\d+):(\d+)[.,](\d+)/);
  return m ? (+m[1]) * 3600000 + (+m[2]) * 60000 + (+m[3]) * 1000 + (+m[4]) : 0;
}
function parseVtt(text) {
  const cues = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    const tline = lines.find((l) => l.includes("-->"));
    if (!tline) continue;
    const [a, b] = tline.split("-->");
    const txt = lines.slice(lines.indexOf(tline) + 1).join(" ").trim();
    if (txt) cues.push({ start: tsToMs(a), end: tsToMs(b), text: txt });
  }
  return cues;
}
function wordsFromCues(cues) {
  const words = [];
  for (const c of cues) {
    const toks = c.text.split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const dur = Math.max(c.end - c.start, toks.length * 110);
    for (let j = 0; j < toks.length; j++)
      words.push({ text: toks[j], startMs: Math.round(c.start + (dur * j) / toks.length), endMs: Math.round(c.start + (dur * (j + 1)) / toks.length) });
  }
  return words;
}
function groupWords(words) {
  const segs = []; let cur = null;
  const flush = () => { if (cur) { segs.push({ text: cur.text, startMs: cur.startMs, endMs: cur.endMs, words: cur.words }); cur = null; } };
  for (const w of words) {
    if (!cur) cur = { text: w.text, startMs: w.startMs, endMs: w.endMs, words: [w] };
    else { cur.text += " " + w.text; cur.endMs = w.endMs; cur.words.push(w); }
    const endsSentence = /[.?!]$/.test(cur.text);
    const longClause = /[,;:—–]$/.test(cur.text) && cur.text.length >= 58;
    if (endsSentence || longClause || cur.text.length >= 92) flush();
  }
  flush();
  const MIN_MS = 750;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const onscreen = i < segs.length - 1 ? segs[i + 1].startMs - s.startMs : Infinity;
    if ((onscreen >= MIN_MS && s.text.length >= 8) || segs.length < 2) continue;
    if (i > 0) { segs[i - 1].text += " " + s.text; segs[i - 1].endMs = s.endMs; segs[i - 1].words = segs[i - 1].words.concat(s.words); }
    else { segs[i + 1].text = s.text + " " + segs[i + 1].text; segs[i + 1].startMs = s.startMs; segs[i + 1].words = s.words.concat(segs[i + 1].words); }
    segs.splice(i, 1); i--;
  }
  return segs;
}
const captions = groupWords(wordsFromCues(parseVtt(readFileSync(voVtt, "utf8"))));
if (!captions.length) throw new Error("No captions parsed from VTT");
const voDurSec = parseFloat(capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", voMp3]));
const tailSec = 2.8;
const totalSec = +(voDurSec + tailSec).toFixed(3);
const durationInFrames = Math.round(totalSec * FPS);
log(`Voice ${voDurSec.toFixed(1)}s · ${captions.length} captions · ${totalSec}s total`);

// ---- 4. HyperFrames project on the native FS (fast frame IO) ------------
// Use a DISK-backed home dir, not os.tmpdir() — on WSL /tmp is tmpfs (RAM), and
// render frame IO there would consume the limited RAM. ~/.simreels-hf is on ext4.
const hfBase = process.platform === "win32" ? join(tmpdir(), "simreels-hf") : join(homedir(), ".simreels-hf");
const hfDir = join(hfBase, `day-${DD}`);
// Scaffold a valid hyperframes project FIRST — `init` refuses a non-empty dir, so it
// must run before we create images/. Clean any partial dir left by a failed prior run.
if (!existsSync(join(hfDir, "hyperframes.json"))) {
  rmSync(hfDir, { recursive: true, force: true });
  log("Scaffolding HyperFrames project…");
  run("npx", ["--yes", "hyperframes", "init", hfDir, "--non-interactive", "--skip-skills", "--example=blank"]);
}
mkdirSync(join(hfDir, "images"), { recursive: true });
const sceneCache = join(work, "scenes"); // persistent scene cache (survives re-renders)
mkdirSync(sceneCache, { recursive: true });

// scenes: manual hero scenes win; else Pollinations(free)→Pexels→cosmic fallback
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
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const MOODS = ["dark abstract", "nebula cosmos", "silhouette fog", "deep space stars", "smoke light rays", "neon abstract dark", "galaxy void", "abstract particles dark"];
async function pexelsPhoto(query) {
  if (!PEXELS_KEY) return null;
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`, { headers: { Authorization: PEXELS_KEY } });
    const j = await res.json();
    const photos = j.photos || [];
    if (!photos.length) return null;
    const pick = photos[Math.floor((day * 7) % photos.length)];
    return await dl(pick.src.portrait || pick.src.large2x || pick.src.original);
  } catch { return null; }
}
async function fetchScenesToCache(caps) {
  const style = "cinematic dark conceptual film still, no text, no words, no letters, moody volumetric light, deep indigo and terracotta palette, film grain, 9:16, depicting:";
  const out = [];
  for (let i = 0; i < caps.length; i++) {
    const tmp = join(sceneCache, `s${i}.src`);
    const jpg = join(sceneCache, `s${i}.jpg`);
    const prompt = encodeURIComponent(`${style} ${caps[i].text}`);
    const pollUrl = `https://image.pollinations.ai/prompt/${prompt}?width=768&height=1344&nologo=true&model=flux&seed=${day * 100 + i}`;
    let buf = null, src = "pollinations";
    for (let a = 0; a < 2 && !buf; a++) { try { buf = await dl(pollUrl); } catch {} }
    if (!buf) { buf = await pexelsPhoto(MOODS[(day + i) % MOODS.length]); src = "pexels"; }
    if (!buf) { log(`  scene ${i + 1} failed — skipping`); continue; }
    try {
      writeFileSync(tmp, buf);
      const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-frames:v", "1", "-q:v", "3", jpg]);
      if (r.status !== 0) throw new Error("ffmpeg");
      rmSync(tmp, { force: true });
      out.push({ file: `s${i}.jpg`, startMs: caps[i].startMs });
      process.stdout.write(`  scene ${i + 1}/${caps.length} ✓ (${src})\r`);
    } catch (e) { log(`  scene ${i + 1} encode failed (${e.message})`); }
  }
  process.stdout.write("\n");
  writeFileSync(join(sceneCache, "scenes.json"), JSON.stringify(out));
  return out;
}
let sceneList = [];
const manual = join(ROOT, "content", "scenes", `day-${DD}.json`);
const cacheManifest = join(sceneCache, "scenes.json");
if (existsSync(manual)) {
  const m = JSON.parse(readFileSync(manual, "utf8"));
  m.forEach((s, i) => {
    const srcImg = join(ROOT, "studio", "public", s.image.replace(/^\/?/, ""));
    const dst = join(sceneCache, `m${i}.jpg`);
    if (existsSync(srcImg)) { cpSync(srcImg, dst); sceneList.push({ file: `m${i}.jpg`, startMs: s.startMs ?? Math.round((i / m.length) * voDurSec * 1000) }); }
  });
  log(`Manual hero scenes: ${sceneList.length}`);
} else if (process.env.NO_SCENES !== "1") {
  if (existsSync(cacheManifest) && process.env.FORCE_SCENES !== "1") {
    sceneList = JSON.parse(readFileSync(cacheManifest, "utf8"));
    log(`Reusing ${sceneList.length} cached scenes (FORCE_SCENES=1 to refetch)`);
  } else {
    log("Generating cinematic scenes via Pollinations (free)…");
    sceneList = await fetchScenesToCache(captions);
    log(`Scenes: ${sceneList.length}/${captions.length}`);
  }
}
// copy cached scene files into the hf project and build the final scene list
const scenes = sceneList.map((s) => {
  cpSync(join(sceneCache, s.file), join(hfDir, "images", s.file));
  return { image: `images/${s.file}`, startMs: s.startMs };
});

// ---- 5. emit the HyperFrames composition --------------------------------
const reelData = { day, title: item.title, kicker: item.kicker || `philosophic_kid`, cta: item.cta || "Follow for the questions that don't let you sleep.", totalSec, captions, scenes };
writeFileSync(join(hfDir, "index.html"), emitComposition(reelData));

writeFileSync(join(hfDir, "index.html"), emitComposition(reelData)); // (re)write our composition

// lint (non-fatal: report but continue; --strict can be added later)
log("Linting composition…");
spawnSync("npx", ["--yes", "hyperframes", "lint", hfDir], { stdio: "inherit" });

// ---- 6. render the silent video (1 worker = low-mem safe) ---------------
const silent = join(work, "hf-silent.mp4");
log(`Rendering with HyperFrames (${QUALITY}, 1 worker)…`);
run("npx", ["--yes", "hyperframes", "render", hfDir, "-o", silent, "-w", "1", "-q", QUALITY, "--fps", String(FPS)]);

// ---- 7. dark-ambient drone ----------------------------------------------
const music = join(work, "music.mp3");
const fadeOut = Math.max(0, totalSec - 4);
log("Synthesizing dark ambient drone…");
const droneFilter =
  "[0:a]volume=0.5[a];[1:a]volume=0.30[b];[2:a]volume=0.20[c];[3:a]lowpass=f=380,volume=0.55[d];" +
  "[a][b][c][d]amix=inputs=4:normalize=0[mx];" +
  `[mx]tremolo=f=0.1:d=0.4,lowpass=f=520,aecho=0.8:0.7:1100|1700:0.45|0.30,volume=2.3,alimiter=limit=0.9,afade=t=in:d=4,afade=t=out:st=${fadeOut}:d=4[out]`;
run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=55:sample_rate=44100", "-f", "lavfi", "-i", "sine=frequency=82.41:sample_rate=44100",
  "-f", "lavfi", "-i", "sine=frequency=110:sample_rate=44100", "-f", "lavfi", "-i", "anoisesrc=color=brown:sample_rate=44100:amplitude=0.18",
  "-filter_complex", droneFilter, "-map", "[out]", "-t", String(totalSec), "-c:a", "libmp3lame", "-q:a", "4", music]);

// ---- 8. mux: yuv420p (tv range) + faststart -----------------------------
mkdirSync(join(ROOT, "renders"), { recursive: true });
const outName = `Day-${DD}-${slug(item.title)}.mp4`;
const outFile = join(ROOT, "renders", outName);
log("Mixing audio and muxing final reel…");
const muxFilter =
  `[0:v]scale=${W}:${H}:in_range=full:out_range=tv:flags=accurate_rnd,format=yuv420p[v];` +
  "[1:a]aresample=44100,highpass=f=80,acompressor=threshold=0.06:ratio=3:attack=10:release=220,aecho=0.85:0.5:55:0.12,apad,volume=1.0[vo];" +
  "[2:a]aresample=44100,volume=0.16[mu];" +
  "[vo][mu]amix=inputs=2:duration=longest:normalize=0:dropout_transition=3[mix];[mix]alimiter=limit=0.95[a]";
run("ffmpeg", ["-y", "-i", silent, "-i", voMp3, "-i", music, "-filter_complex", muxFilter,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-color_range", "tv",
  "-crf", "18", "-preset", "veryfast", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k",
  "-t", String(totalSec), outFile]);

log(`\x1b[32m✓ DONE\x1b[0m  renders/${outName}`);
console.log(`\nCaption to post:\n${item.caption}\n\n${(item.hashtags || []).join(" ")}`);

// ---- 9. gates -----------------------------------------------------------
spawnSync(process.execPath, [join(__dirname, "qa.mjs"), String(day)], { stdio: "inherit" });
const gate = join(ROOT, ".claude", "skills", "video-editing", "scripts", "verify-render.mjs");
if (existsSync(gate)) spawnSync(process.execPath, [gate, outFile], { stdio: "inherit" });

// ========================================================================
// Composition emitter — the editorial grammar, parametrized per day.
// ========================================================================
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
// deterministic PRNG (mulberry32) so ember/FX placement is reproducible per day
function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function keyIndex(words) {
  const STOP = new Set("the a an and or but of to in is are was were be been being it its you your we our they them this that with for from as at by into not no so if then than too very can could will would i he she his her on off out up down".split(" "));
  let bi = -1, bl = 1;
  words.forEach((w, j) => { const t = w.text.toLowerCase().replace(/[^a-z]/g, ""); if (!STOP.has(t) && t.length > bl) { bl = t.length; bi = j; } });
  return bi;
}

function emitComposition(d) {
  const T = d.totalSec;
  // caption clips: each shows until the next caption starts
  const caps = d.captions.map((c, i) => {
    const start = c.startMs / 1000;
    const end = i < d.captions.length - 1 ? d.captions[i + 1].startMs / 1000 : T - 0.3;
    return { ...c, start: +start.toFixed(2), dur: +Math.max(0.7, end - start).toFixed(2), ki: keyIndex(c.words || []) };
  });
  // scene clips: alternate track 1/2 so consecutive scenes crossfade (no same-track touch)
  const XF = 0.5;
  const sc = d.scenes.map((s, i) => {
    const start = i === 0 ? 0 : s.startMs / 1000 - XF / 2;
    const end = i < d.scenes.length - 1 ? d.scenes[i + 1].startMs / 1000 + XF / 2 : T;
    return { ...s, idx: i, track: i % 2 === 0 ? 1 : 2, start: +Math.max(0, start).toFixed(2), dur: +Math.max(1.2, end - Math.max(0, start)).toFixed(2) };
  });
  // living embers (positions resolved deterministically at emit time)
  const rand = rng(d.day * 991 + 7);
  const embers = Array.from({ length: 14 }, () => ({
    x: +(rand() * 100).toFixed(1), size: +(2 + rand() * 5).toFixed(1), dur: +(6 + rand() * 6).toFixed(1),
    drift: +((rand() - 0.5) * 90).toFixed(0), op: +(0.25 + rand() * 0.5).toFixed(2), startY: +(-rand() * H * 1.2).toFixed(0),
  }));

  const sceneHTML = sc.map((s) => `      <section id="sc-${s.idx}" class="clip scene" data-start="${s.start}" data-duration="${s.dur}" data-track-index="${s.track}">
        <div class="scene-inner" id="sci-${s.idx}"><div class="cam" id="cam-${s.idx}" style="background-image:url('${s.image}')"></div></div>
      </section>`).join("\n");

  const capHTML = caps.map((c, i) => {
    const words = (c.words || [{ text: c.text }]).map((w, j) =>
      `<span class="w${j === c.ki ? " accent" : ""}" id="w-${i}-${j}">${esc(w.text)}</span>`).join(" ");
    return `      <section id="cap-${i}" class="clip cap" data-start="${c.start}" data-duration="${c.dur}" data-track-index="6">
        <div class="cap-inner" id="capi-${i}">${words}</div>
      </section>`;
  }).join("\n");

  const emberHTML = embers.map((e, i) =>
    `<div class="ember" id="ember-${i}" style="left:${e.x}cqw;width:${e.size}px;height:${e.size}px;bottom:-6cqh;opacity:${e.op}"></div>`).join("");

  // ---- GSAP timeline (synchronous, paused, registered on window.__timelines.main) ----
  const tw = [];
  // breathing background glow
  tw.push(`tl.fromTo('#glow',{scale:0.92,opacity:0.45},{scale:1.16,opacity:0.8,duration:${(T / 2).toFixed(2)},ease:'sine.inOut',repeat:1,yoyo:true},0);`);
  // rising embers (finite repeats)
  embers.forEach((e, i) => {
    const reps = Math.max(1, Math.ceil((T + Math.abs(e.startY) / 200) / e.dur));
    tw.push(`tl.fromTo('#ember-${i}',{y:${e.startY},x:0},{y:${(-H * 1.25).toFixed(0)},x:${e.drift},duration:${e.dur},ease:'none',repeat:${reps}},0);`);
  });
  // diagonal light sweep, periodic
  const sweepReps = Math.max(1, Math.ceil(T / 8));
  tw.push(`tl.fromTo('#sweep',{xPercent:-180},{xPercent:200,duration:5.5,ease:'sine.inOut',repeat:${sweepReps},repeatDelay:2.4},1.5);`);
  // scenes: punch-settle entry + stronger Ken-Burns + crossfade out
  sc.forEach((s) => {
    tw.push(`tl.fromTo('#sci-${s.idx}',{opacity:0},{opacity:1,duration:${XF},ease:'power2.out'},${s.start});`);
    tw.push(`tl.fromTo('#sci-${s.idx}',{scale:1.07},{scale:1,duration:0.7,ease:'power3.out'},${s.start});`);
    if (s.idx < sc.length - 1) {
      tw.push(`tl.to('#sci-${s.idx}',{opacity:0,duration:${XF},ease:'power1.in'},${(s.start + s.dur - XF).toFixed(2)});`);
      tw.push(`tl.set('#sci-${s.idx}',{opacity:0},${(s.start + s.dur).toFixed(2)});`); // seek-safe hard kill
    }
    const dir = s.idx % 2 === 0 ? 1 : -1;
    tw.push(`tl.fromTo('#cam-${s.idx}',{scale:1.1,xPercent:${-4 * dir},yPercent:3},{scale:1.27,xPercent:${4 * dir},yPercent:-3,duration:${s.dur},ease:'none'},${s.start});`);
  });
  // captions: word-by-word punch, synced to the voice; keyword pops
  caps.forEach((c, i) => {
    (c.words || []).forEach((w, j) => {
      let wt = w.startMs / 1000;
      if (wt < c.start) wt = c.start;
      if (wt > c.start + c.dur - 0.18) wt = c.start + c.dur - 0.18;
      tw.push(`tl.fromTo('#w-${i}-${j}',{opacity:0,y:32,scale:0.5,rotationX:-60},{opacity:1,y:0,scale:1,rotationX:0,duration:0.26,ease:'back.out(2)'},${wt.toFixed(2)});`);
    });
    if (c.ki >= 0) {
      let kt = c.words[c.ki].startMs / 1000;
      kt = Math.min(Math.max(kt, c.start), c.start + c.dur - 0.18);
      tw.push(`tl.to('#w-${i}-${c.ki}',{scale:1.12,duration:0.2,ease:'back.out(3)',overwrite:'auto'},${(kt + 0.27).toFixed(2)});`); // starts after entrance (no overlap)
    }
    tw.push(`tl.to('#capi-${i}',{opacity:0,y:-22,duration:0.3,ease:'power2.in'},${(c.start + c.dur - 0.3).toFixed(2)});`);
    tw.push(`tl.set('#capi-${i}',{opacity:0},${(c.start + c.dur).toFixed(2)});`); // seek-safe hard kill
  });
  // hook: glitch-in + boot sweep + blink, then out by 3s
  tw.push(`tl.fromTo('#hook',{opacity:0},{opacity:1,duration:0.25,ease:'power2.out'},0.1);`);
  tw.push(`tl.fromTo('#hook-warn',{opacity:0,scale:0.88,y:12},{opacity:1,scale:1,y:0,duration:0.45,ease:'back.out(2.6)'},0.15);`);
  tw.push(`tl.fromTo('#hook-warn',{x:-8},{x:0,duration:0.55,ease:'elastic.out(1,0.32)'},0.2);`);
  tw.push(`tl.fromTo('#boot',{y:0,opacity:0.85},{y:${(H * 0.92).toFixed(0)},opacity:0,duration:0.7,ease:'power1.in'},0.1);`);
  const blinkRep = Math.max(0, Math.floor(2.4 / 0.5) - 1);
  tw.push(`tl.to('#hook-watch',{opacity:0.28,duration:0.25,repeat:${blinkRep},yoyo:true,ease:'none'},0.7);`);
  tw.push(`tl.to('#hook',{opacity:0,duration:0.4,ease:'power2.in'},2.7);`);
  // retention progress bar
  tw.push(`tl.fromTo('#progbar',{scaleX:0},{scaleX:1,duration:${T},ease:'none'},0);`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<title>Simulation & Mind — Day ${d.day}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Silkscreen:wght@400;700&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  :root{ --terra:#DA7756; --ivory:#F0EEE6; --void:#05070d; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--void); }
  #root{ position:relative; width:${W}px; height:${H}px; overflow:hidden; container-type:size;
         background:radial-gradient(120% 80% at 50% 6%, #161c28 0%, #080b12 58%, #03040a 100%);
         font-family:'IBM Plex Mono', ui-monospace, monospace; color:var(--ivory); }
  .clip{ position:absolute; inset:0; }
  /* scenes — brighter + more alive */
  .scene-inner{ position:absolute; inset:0; opacity:0; will-change:transform,opacity; }
  .cam{ position:absolute; inset:-6%; background-size:cover; background-position:center; will-change:transform;
        filter:brightness(0.74) saturate(1.18) contrast(1.08); }
  /* living FX layer (above scenes, below captions) */
  .fx{ z-index:3; pointer-events:none; }
  #glow{ position:absolute; left:50%; top:40%; width:130cqw; height:130cqw; transform:translate(-50%,-50%); border-radius:50%; will-change:transform,opacity;
    background:radial-gradient(circle, rgba(218,119,86,.20) 0%, rgba(218,119,86,.07) 36%, transparent 66%); }
  .embers{ position:absolute; inset:0; -webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 16%,#000 74%,transparent 100%);
    mask-image:linear-gradient(180deg,transparent 0%,#000 16%,#000 74%,transparent 100%); }
  .ember{ position:absolute; border-radius:50%; will-change:transform; box-shadow:0 0 8px rgba(218,119,86,.65);
    background:radial-gradient(circle, rgba(246,182,146,.95), rgba(218,119,86,.25) 70%, transparent); }
  #sweep{ position:absolute; top:-20%; left:0; width:58cqw; height:140%; transform:rotate(13deg); opacity:.5; will-change:transform;
    background:linear-gradient(90deg, transparent, rgba(240,238,230,.05), rgba(240,238,230,.16), rgba(240,238,230,.05), transparent); }
  /* legibility veil + vignette */
  #root::after{ content:''; position:absolute; inset:0; pointer-events:none; z-index:5;
    background:linear-gradient(180deg, rgba(5,7,13,.50) 0%, rgba(5,7,13,.02) 26%, rgba(5,7,13,.18) 54%, rgba(5,7,13,.90) 100%),
               radial-gradient(135% 95% at 50% 40%, transparent 52%, rgba(0,0,0,.62) 100%); }
  .scan{ position:absolute; inset:0; z-index:6; pointer-events:none; opacity:.09; mix-blend-mode:overlay;
    background:repeating-linear-gradient(0deg, rgba(255,255,255,.7) 0 1px, transparent 1px 3px); }
  /* chrome */
  .chrome{ z-index:7; }
  .topbar{ position:absolute; top:5.5cqh; left:6cqw; right:6cqw; display:flex; align-items:center; justify-content:space-between;
    font-size:2.7cqw; letter-spacing:.18em; text-transform:uppercase; color:#cbd5e1; }
  .topbar .dot{ color:var(--terra); }
  .progwrap{ position:absolute; top:9.4cqh; left:6cqw; right:6cqw; height:3px; background:rgba(255,255,255,.14); border-radius:2px; overflow:hidden; }
  #progbar{ height:100%; width:100%; transform-origin:left center; background:linear-gradient(90deg,var(--terra),#f6b692); box-shadow:0 0 10px rgba(218,119,86,.6); }
  .handle{ position:absolute; bottom:5cqh; left:0; right:0; text-align:center; font-size:2.9cqw; letter-spacing:.22em; color:#94a3b8; text-transform:lowercase; }
  .handle b{ color:var(--ivory); font-weight:600; }
  /* hook */
  #hook{ position:absolute; left:0; right:0; top:32cqh; text-align:center; z-index:9; }
  #hook .warn{ font-family:'Silkscreen',monospace; font-size:6.4cqw; color:var(--terra); letter-spacing:.05em;
    text-shadow:0 0 30px rgba(218,119,86,.6), 2px 0 0 rgba(94,234,212,.35), -2px 0 0 rgba(244,114,182,.35); }
  #hook-watch{ display:block; margin-top:2.4cqh; font-size:3.4cqw; letter-spacing:.34em; color:var(--ivory); }
  #boot{ position:absolute; left:0; right:0; top:0; height:3px; will-change:transform,opacity;
    background:linear-gradient(90deg,transparent,rgba(218,119,86,.9),transparent); box-shadow:0 0 18px rgba(218,119,86,.85); }
  /* captions — kinetic words */
  .cap{ z-index:8; }
  .cap-inner{ position:absolute; left:6cqw; right:6cqw; bottom:21cqh; text-align:center; perspective:760px; will-change:transform,opacity; }
  .w{ display:inline-block; font-weight:700; font-size:7.7cqw; line-height:1.26; letter-spacing:.004em; will-change:transform,opacity;
    text-shadow:0 4px 30px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.95); }
  .w.accent{ color:var(--terra); text-shadow:0 0 26px rgba(218,119,86,.65), 0 4px 18px rgba(0,0,0,.9); }
</style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${T}">
${sceneHTML || '      <section class="clip" data-start="0" data-duration="' + T + '" data-track-index="1"></section>'}

    <!-- living FX -->
    <section id="fx" class="clip fx" data-start="0" data-duration="${T}" data-track-index="3">
      <div id="glow"></div>
      <div id="sweep"></div>
      <div class="embers">${emberHTML}</div>
    </section>

    <div class="scan"></div>

    <!-- persistent chrome -->
    <section id="chrome-bar" class="clip chrome" data-start="0" data-duration="${T}" data-track-index="7">
      <div class="topbar"><span><span class="dot">◆</span> ${esc(d.kicker)}</span><span>DAY ${d.day} / 51</span></div>
      <div class="progwrap"><div id="progbar"></div></div>
      <div class="handle">@<b>philosophic_kid</b> <span style="color:var(--terra)">▮</span></div>
    </section>

    <!-- 3s engineered hook -->
    <section id="hook" class="clip" data-start="0" data-duration="3" data-track-index="8">
      <div id="boot"></div>
      <div id="hook-warn" class="warn">⚠ SIMULATION CHECK</div>
      <span id="hook-watch">▶ WATCH TO THE END</span>
    </section>

${capHTML}
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    ${tw.join("\n    ")}
    window.__timelines["main"] = tl;
  </script>
</body>
</html>`;
}
