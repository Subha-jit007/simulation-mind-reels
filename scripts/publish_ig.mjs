#!/usr/bin/env node
/**
 * publish_ig.mjs [day]
 *
 * Publishes ONE rendered reel to Instagram via the official (free) Graph API.
 * - Picks the next un-posted rendered day (or the day passed as an argument).
 * - Builds a public video URL (raw.githubusercontent.com by default).
 * - Creates a REELS media container, waits for processing, then publishes.
 * - Records the post in content/state.json so it never double-posts.
 *
 * Required env (set as GitHub Actions secrets):
 *   IG_USER_ID        Instagram Business/Creator account id (numeric)
 *   IG_ACCESS_TOKEN   long-lived Page access token with instagram_content_publish
 * Optional env:
 *   VIDEO_BASE_URL    override base url for the mp4 (default: raw github for this repo)
 *   GRAPH_VERSION     default v21.0
 *   DRY_RUN=1         do everything except the final publish (prints what it would do)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
// IG_LOGIN=1 -> use the Instagram Login API (graph.instagram.com, no Facebook Page needed).
// otherwise -> Facebook-Page Graph API (graph.facebook.com).
const HOST = process.env.IG_LOGIN === "1" ? "graph.instagram.com" : "graph.facebook.com";
const GRAPH = `https://${HOST}/${process.env.GRAPH_VERSION || "v21.0"}`;
const DRY = process.env.DRY_RUN === "1";

const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
const statePath = join(ROOT, "content", "state.json");
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { posted: [] };

const dd = (n) => String(n).padStart(2, "0");
const renderDir = join(ROOT, "renders");
const renders = existsSync(renderDir) ? readdirSync(renderDir).filter((f) => f.endsWith(".mp4")) : [];
const fileForDay = (day) => renders.find((f) => new RegExp(`^Day-${dd(day)}[ -]`).test(f));

// ---- choose the day ----------------------------------------------------
let day = parseInt(process.argv[2] || "0", 10);
if (!day) {
  const candidate = reels
    .map((r) => r.day)
    .sort((a, b) => a - b)
    .find((d) => fileForDay(d) && !state.posted.includes(d));
  if (!candidate) {
    console.log("Nothing to post: no rendered, un-posted reel found. Render more with build_reel.mjs.");
    process.exit(0);
  }
  day = candidate;
}
const item = reels.find((r) => r.day === day);
const file = fileForDay(day);
if (!file) throw new Error(`No rendered MP4 for day ${day} (run: node scripts/build_reel.mjs ${day})`);
if (state.posted.includes(day)) {
  console.log(`Day ${day} already posted. Nothing to do.`);
  process.exit(0);
}

// ---- public video url --------------------------------------------------
// VIDEO_URL  = exact public mp4 url (used by the cloud job after a Release upload)
// VIDEO_BASE = base folder url; filename is appended
// fallback   = raw.githubusercontent.com for this repo
let videoUrl = process.env.VIDEO_URL;
if (!videoUrl) {
  let base = process.env.VIDEO_BASE_URL;
  if (!base) {
    const repo = process.env.GITHUB_REPOSITORY; // owner/repo
    const branch = process.env.GITHUB_REF_NAME || "main";
    if (!repo) throw new Error("Set VIDEO_URL / VIDEO_BASE_URL or run in GitHub Actions.");
    base = `https://raw.githubusercontent.com/${repo}/${branch}/renders`;
  }
  videoUrl = `${base.replace(/\/$/, "")}/${encodeURIComponent(file)}`;
}
// optional monetization CTA, appended automatically once MONETIZE_URL is set
const promo = process.env.MONETIZE_URL
  ? `\n\n${process.env.MONETIZE_CTA || "📖 51 mind-benders + wallpaper pack →"} ${process.env.MONETIZE_URL}`
  : "";
const caption = `${item.caption}${promo}\n\n${(item.hashtags || []).join(" ")}`;

console.log(`▸ Day ${day}: "${item.title}"`);
console.log(`  video: ${videoUrl}`);
console.log(`  caption: ${item.caption}`);

if (!process.env.IG_ACCESS_TOKEN || (!process.env.IG_USER_ID && process.env.IG_LOGIN !== "1")) {
  if (!DRY) throw new Error("Missing IG_ACCESS_TOKEN (and IG_USER_ID for the Facebook-Page API).");
  console.log("  (DRY_RUN, no token) — would create container + publish here.");
  process.exit(0);
}
let IG = process.env.IG_USER_ID;
const TOKEN = process.env.IG_ACCESS_TOKEN;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, params) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(`Graph error: ${JSON.stringify(json.error)}`);
  return json;
}
async function get(path, fields) {
  const u = `${GRAPH}/${path}?fields=${fields}&access_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(u);
  const json = await res.json();
  if (json.error) throw new Error(`Graph error: ${JSON.stringify(json.error)}`);
  return json;
}

// resolve the IG user id automatically when using Instagram Login
if (!IG) {
  const me = await get("me", "user_id,username");
  IG = me.user_id || me.id;
  console.log(`▸ IG account: @${me.username || "?"} (id ${IG})`);
}

// ---- 1. create container ----------------------------------------------
console.log("▸ Creating media container…");
const container = await api(`${IG}/media`, {
  media_type: "REELS",
  video_url: videoUrl,
  caption,
  share_to_feed: "true",
});
const creationId = container.id;

// ---- 2. wait for processing -------------------------------------------
console.log("▸ Waiting for Instagram to process the video…");
let ready = false;
for (let i = 0; i < 60; i++) {
  await sleep(5000);
  const st = await get(creationId, "status_code,status");
  process.stdout.write(`  status: ${st.status_code}\r`);
  if (st.status_code === "FINISHED") { ready = true; break; }
  if (st.status_code === "ERROR") throw new Error(`Processing failed: ${st.status || ""}`);
}
if (!ready) throw new Error("Timed out waiting for video processing (5 min).");

// ---- 3. publish --------------------------------------------------------
if (DRY) {
  console.log("\n▸ DRY_RUN: container ready, skipping publish.");
  process.exit(0);
}
console.log("\n▸ Publishing…");
const pub = await api(`${IG}/media_publish`, { creation_id: creationId });

state.posted.push(day);
state.lastPostedDay = day;
state.lastPostedAt = new Date().toISOString();
writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log(`✓ POSTED Day ${day} — media id ${pub.id}`);
