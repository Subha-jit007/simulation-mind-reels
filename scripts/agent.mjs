#!/usr/bin/env node
/**
 * agent.mjs — the growth loop. Measure, learn, then actually change the next
 * reel. Runs daily, free, no LLM.
 *
 * The previous version read like_count and comments_count and wrote a report
 * recommending a voice. On a 36-follower account likes range 1..7 and comments
 * are all zero, so those recommendations were fitted to noise, and nothing
 * downstream consumed them anyway — the report was advice nobody read.
 *
 * This version:
 *   1. MEASURES reach / views / watch-time per reel where the token allows it,
 *      falling back to likes only when Meta refuses, and says which it used.
 *   2. ATTRIBUTES each result to the choices that produced it, by joining
 *      against content/renders.json (length, palette, voice, beat count).
 *   3. LEARNS only where there is enough evidence to. A dimension with fewer
 *      than MIN_SAMPLES per arm, or with arms inside the noise band, is left
 *      alone and reported as still-exploring. Refusing to conclude is a
 *      feature; the old agent's confident advice off n=1 was the bug.
 *   4. ACTS by writing targetSeconds / palette / voice onto upcoming days in
 *      content/reels.json, with an explore share so it keeps gathering data
 *      instead of collapsing onto a local maximum.
 *
 * It never buys, bots, or fakes engagement.
 *
 * Env: IG_ACCESS_TOKEN. Optional: GRAPH_VERSION, DRY_RUN=1.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GRAPH = `https://graph.instagram.com/${process.env.GRAPH_VERSION || "v21.0"}`;
const TOKEN = process.env.IG_ACCESS_TOKEN;
const DRY = process.env.DRY_RUN === "1";
// AGENT_FIXTURE points at a JSON file of { me, media, insights } and replaces
// every network call. It exists so the learn/act logic can be exercised
// without burning a live token or waiting a day for real numbers.
const FIXTURE = process.env.AGENT_FIXTURE ? JSON.parse(readFileSync(process.env.AGENT_FIXTURE, "utf8")) : null;
if (!TOKEN && !FIXTURE) { console.log("No IG_ACCESS_TOKEN — agent idle."); process.exit(0); }

// How much evidence before the agent is allowed to change its mind.
const MIN_SAMPLES = 4;      // per arm of a dimension
const EDGE = 0.15;          // winner must beat the runner-up by 15%
const T_GATE = 2.0;         // ...and clear the spread of the data
const T_GATE_NOISY = 3.0;   // ...by more, when all we have is likes
const EXPLORE_SHARE = 0.25; // a quarter of upcoming days deliberately vary

const rd = (p, dflt) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : dflt);
const reelsPath = join(ROOT, "content", "reels.json");
const reels = rd(reelsPath, []);
const renders = FIXTURE?.renders ?? rd(join(ROOT, "content", "renders.json"), []);
const apath = join(ROOT, "content", "analytics.json");
const history = rd(apath, []);
const byDay = new Map(renders.map((r) => [r.day, r]));

async function g(path, params = {}) {
  if (FIXTURE) {
    if (path === "me") return FIXTURE.me;
    if (path === "me/media") return { data: FIXTURE.media };
    const [id] = path.split("/");
    const ins = (FIXTURE.insights || {})[id];
    if (!ins) throw new Error("no insights in fixture");
    const want = String(params.metric || "").split(",").filter(Boolean);
    const data = want.filter((m) => ins[m] != null).map((m) => ({ name: m, values: [{ value: ins[m] }] }));
    if (!data.length) throw new Error("metric unavailable");
    return { data };
  }
  const q = new URLSearchParams({ ...params, access_token: TOKEN });
  const r = await fetch(`${GRAPH}/${path}?${q}`);
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error(j.error.message || "graph error");
  return j;
}
async function tryG(path, params) { try { return await g(path, params); } catch { return null; } }

// ---- 1. measure ---------------------------------------------------------
const me = await g("me", { fields: "username,followers_count,media_count" });
const media = (await g("me/media", {
  fields: "id,caption,timestamp,like_count,comments_count,permalink,media_product_type",
  limit: "100",
})).data || [];

// Which retention metrics this token can actually read. Probe once against the
// newest post rather than assuming, then reuse the answer for the whole run.
const CANDIDATES = ["views", "reach", "saved", "shares", "total_interactions", "ig_reels_avg_watch_time"];
let available = [];
if (media[0]) {
  for (const m of CANDIDATES) {
    const r = await tryG(`${media[0].id}/insights`, { metric: m });
    if (r?.data?.length) available.push(m);
  }
}
const hasReach = available.includes("views") || available.includes("reach");
console.log(`metrics available: ${available.length ? available.join(", ") : "NONE (likes only)"}`);

async function insightsFor(id) {
  if (!available.length) return {};
  const r = await tryG(`${id}/insights`, { metric: available.join(",") });
  const out = {};
  for (const d of r?.data || []) {
    out[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? 0;
  }
  return out;
}

const scored = [];
for (const m of media) {
  const first = (m.caption || "").split("\n")[0].trim();
  const reel = reels.find((r) => first.startsWith((r.caption || "").split("\n")[0].slice(0, 18)));
  const ins = await insightsFor(m.id);
  const rec = byDay.get(reel?.day);
  const views = ins.views ?? ins.reach ?? null;
  const watch = ins.ig_reels_avg_watch_time != null ? ins.ig_reels_avg_watch_time / 1000 : null;

  scored.push({
    id: m.id, day: reel?.day, title: reel?.title,
    voice: rec?.voice ?? reel?.voice, palette: rec?.palette ?? reel?.palette,
    targetSeconds: rec?.targetSeconds ?? null, seconds: rec?.seconds ?? null,
    beats: rec?.beats ?? null, style: rec?.style ?? "legacy",
    likes: m.like_count || 0, comments: m.comments_count || 0,
    views, reach: ins.reach ?? null, saved: ins.saved ?? null, shares: ins.shares ?? null,
    watchSeconds: watch,
    // Retention is the metric Instagram actually distributes on. Everything
    // else here is downstream of it.
    retention: watch != null && rec?.seconds ? +(watch / rec.seconds).toFixed(3) : null,
    permalink: m.permalink,
  });
}

// The primary signal, in order of how much it's worth trusting.
const primary = (s) =>
  s.retention != null ? s.retention
  : s.views != null ? s.views
  : s.likes + s.comments * 3;
const primaryName = scored.some((s) => s.retention != null) ? "retention"
  : scored.some((s) => s.views != null) ? "views" : "likes (noisy)";

scored.sort((a, b) => primary(b) - primary(a));

const prev = history[history.length - 1];
const snapshot = {
  date: new Date().toISOString().slice(0, 10),
  followers: me.followers_count ?? null,
  posts: me.media_count ?? media.length,
  metric: primaryName,
  metricsAvailable: available,
  media: scored.map((s) => ({
    day: s.day, likes: s.likes, comments: s.comments, views: s.views,
    watchSeconds: s.watchSeconds, retention: s.retention,
    targetSeconds: s.targetSeconds, palette: s.palette, voice: s.voice,
  })),
};
history.push(snapshot);
if (!DRY) writeFileSync(apath, JSON.stringify(history, null, 2) + "\n");

// ---- 2. learn (only where the evidence supports it) --------------------
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const variance = (v) => (v.length < 2 ? 0 : v.reduce((a, b) => a + (b - mean(v)) ** 2, 0) / (v.length - 1));

/**
 * A difference in averages is not a finding. Ranking 46 posts by likes will
 * always produce a "winner" — the first run of this reported ember beating
 * signal by 47% on means of 2.17 vs 1.47 likes, which is nothing. So the gap
 * has to clear the spread of the data, not just be positive: a Welch
 * t-statistic above T_GATE, on top of a minimum sample and effect size.
 * And when we're stuck on the likes fallback the bar goes up again, because
 * likes on a 36-follower account carry almost no information about reach.
 */
function analyse(key, bucket = (v) => v) {
  const arms = {};
  for (const s of scored) {
    const v = s[key] == null ? null : bucket(s[key]);
    if (v == null || v === "") continue;
    (arms[v] ??= []).push(primary(s));
  }
  const rows = Object.entries(arms)
    .map(([k, vals]) => ({ arm: k, n: vals.length, mean: mean(vals), var: variance(vals), vals }))
    .sort((a, b) => b.mean - a.mean);

  if (rows.length < 2) return { rows, verdict: null, why: "only one option tried so far" };
  const eligible = rows.filter((r) => r.n >= MIN_SAMPLES);
  if (eligible.length < 2) return { rows, verdict: null, why: `need ${MIN_SAMPLES}+ posts per option` };

  const [best, second] = eligible;
  if (second.mean <= 0 || best.mean < second.mean * (1 + EDGE)) {
    return { rows, verdict: null, why: `too close to call (${best.arm} vs ${second.arm})` };
  }
  const se = Math.sqrt(best.var / best.n + second.var / second.n);
  const t = se > 0 ? (best.mean - second.mean) / se : Infinity;
  const gate = hasReach ? T_GATE : T_GATE_NOISY;
  if (t < gate) {
    return { rows, verdict: null, t, why: `${best.arm} is ahead but inside the noise (t=${t.toFixed(2)}, need ${gate})` };
  }
  return {
    rows, verdict: best.arm, t,
    why: `${best.arm} beats ${second.arm} by ${Math.round((best.mean / second.mean - 1) * 100)}% (t=${t.toFixed(2)}, n=${best.n}+${second.n})`,
  };
}

const lenBucket = (v) => (v <= 14 ? "12-14s" : v <= 20 ? "15-20s" : v <= 28 ? "21-28s" : "29s+");
const findings = {
  length: analyse("targetSeconds", lenBucket),
  palette: analyse("palette"),
  voice: analyse("voice"),
};

// ---- 3. act: write the decisions onto upcoming days --------------------
const posted = new Set(rd(join(ROOT, "content", "state.json"), { posted: [] }).posted || []);
const upcoming = reels.filter((r) => !posted.has(r.day)).sort((a, b) => a.day - b.day).slice(0, 10);

const LENGTHS = { "12-14s": 13, "15-20s": 17, "21-28s": 24, "29s+": 31 };
const EXPLORE_LENGTHS = [13, 17, 22];
const PALETTES = ["void", "signal", "ember"];

const winnerLen = findings.length.verdict ? LENGTHS[findings.length.verdict] : null;
const changes = [];
upcoming.forEach((r, i) => {
  // Deterministic explore slots, so the schedule is reproducible and the
  // agent can't accidentally stop exploring altogether.
  const explore = (r.day % Math.max(2, Math.round(1 / EXPLORE_SHARE))) === 0;
  const before = { targetSeconds: r.targetSeconds, palette: r.palette, voice: r.voice };

  if (explore) {
    r.targetSeconds = EXPLORE_LENGTHS[(r.day + i) % EXPLORE_LENGTHS.length];
    r.palette = PALETTES[(r.day + i) % PALETTES.length];
  } else {
    // Exploit: 16s is the starting prior until length data exists.
    r.targetSeconds = winnerLen ?? 16;
    if (findings.palette.verdict) r.palette = findings.palette.verdict;
    if (findings.voice.verdict) r.voice = findings.voice.verdict;
  }
  if (JSON.stringify(before) !== JSON.stringify({ targetSeconds: r.targetSeconds, palette: r.palette, voice: r.voice })) {
    changes.push(`day ${r.day}: ${r.targetSeconds}s · ${r.palette} · ${r.voice}${explore ? "  (explore)" : ""}`);
  }
});
if (!DRY && changes.length) writeFileSync(reelsPath, JSON.stringify(reels, null, 2) + "\n");

// ---- 4. report ----------------------------------------------------------
const fGrowth = prev?.followers != null && me.followers_count != null ? me.followers_count - prev.followers : null;
const table = (f) => f.rows.length
  ? f.rows.map((r) => `| ${r.arm} | ${r.n} | ${r.mean.toFixed(2)} |`).join("\n")
  : "| — | 0 | — |";

const log = `# 🤖 Growth Agent — ${snapshot.date}

**@${me.username}** · **${me.followers_count ?? "?"} followers**${fGrowth != null ? ` (${fGrowth >= 0 ? "+" : ""}${fGrowth} since last check)` : ""} · ${snapshot.posts} posts

**Optimising on:** \`${primaryName}\`
${hasReach ? "" : "\n> ⚠️ Meta is not returning reach or watch-time for this token, so the agent is working from likes, which on this account range 1–7. It will keep the current settings and keep exploring rather than pretend to learn from that. Fix the token scope and the loop starts working properly.\n"}
## Best reels
${scored.slice(0, 5).map((s, i) => `${i + 1}. **Day ${s.day ?? "?"} — ${s.title ?? s.id}** · ${s.retention != null ? `${Math.round(s.retention * 100)}% watched` : s.views != null ? `${s.views} views` : `${s.likes} likes`}`).join("\n") || "No posts measured yet."}

## What the data supports
### Length
${findings.length.verdict ? `✅ **${findings.length.verdict}** — ${findings.length.why}` : `⏳ Still exploring — ${findings.length.why}`}

| length | posts | ${primaryName} |
|---|---|---|
${table(findings.length)}

### Palette
${findings.palette.verdict ? `✅ **${findings.palette.verdict}** — ${findings.palette.why}` : `⏳ Still exploring — ${findings.palette.why}`}

| palette | posts | ${primaryName} |
|---|---|---|
${table(findings.palette)}

### Voice
${findings.voice.verdict ? `✅ **${findings.voice.verdict}** — ${findings.voice.why}` : `⏳ Still exploring — ${findings.voice.why}`}

| voice | posts | ${primaryName} |
|---|---|---|
${table(findings.voice)}

## What it changed for upcoming reels
${changes.length ? changes.map((c) => `- ${c}`).join("\n") : "- Nothing. Not enough evidence to justify a change."}

## 💰 Paid-promo readiness
${(() => {
  const f = me.followers_count || 0;
  if (f >= 10000) return "- 🎯 **10k+** — media kit and a per-promo rate; expect inbound.";
  if (f >= 5000) return "- 🎯 **5k+** — shoutouts and affiliate promos become sellable. Sponsors weigh engagement rate over follower count.";
  if (f >= 1000) return "- 🎯 **1k+** — nano-influencer range. Put a contact email in the bio.";
  return "- 🎯 **Under 1k** — growth phase. Saves and shares are the levers, not likes.";
})()}

*Measured automatically. The agent never buys, bots, or fakes engagement.*
`;
if (!DRY) writeFileSync(join(ROOT, "AGENT_LOG.md"), log);
console.log(log);
console.log(`Agent: ${me.followers_count ?? "?"} followers · ${media.length} posts · ${changes.length} upcoming reels retuned.`);
