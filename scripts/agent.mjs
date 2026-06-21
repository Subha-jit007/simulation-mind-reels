#!/usr/bin/env node
/**
 * agent.mjs — the autonomous growth analyst.
 * Runs on a schedule (free, no LLM). After posts go out it:
 *   1. pulls follower count + per-post likes/comments via the Instagram API
 *   2. appends a snapshot to content/analytics.json
 *   3. figures out which reels/voices/topics are winning
 *   4. writes AGENT_LOG.md — a plain-English report + recommendations
 * It never fakes engagement and never touches money. It just measures + learns.
 *
 * Env: IG_ACCESS_TOKEN (Instagram-login token).  Optional: GRAPH_VERSION.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GRAPH = `https://graph.instagram.com/${process.env.GRAPH_VERSION || "v21.0"}`;
const TOKEN = process.env.IG_ACCESS_TOKEN;
if (!TOKEN) { console.log("No IG_ACCESS_TOKEN — agent idle."); process.exit(0); }

const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
const apath = join(ROOT, "content", "analytics.json");
const history = existsSync(apath) ? JSON.parse(readFileSync(apath, "utf8")) : [];

async function g(path, fields) {
  const u = `${GRAPH}/${path}?fields=${fields}&access_token=${encodeURIComponent(TOKEN)}`;
  const r = await fetch(u);
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j;
}

const me = await g("me", "username,followers_count,media_count");
const media = (await g("me/media", "id,caption,timestamp,like_count,comments_count,permalink")).data || [];

// match each media to its reel (by the caption's first line)
const scored = media.map((m) => {
  const first = (m.caption || "").split("\n")[0].trim();
  const reel = reels.find((r) => first.startsWith((r.caption || "").split("\n")[0].slice(0, 18)));
  const eng = (m.like_count || 0) + (m.comments_count || 0) * 3; // comments weighted
  return { id: m.id, day: reel?.day, title: reel?.title, voice: reel?.voice, palette: reel?.palette,
           likes: m.like_count || 0, comments: m.comments_count || 0, eng, permalink: m.permalink };
}).sort((a, b) => b.eng - a.eng);

const prev = history[history.length - 1];
const snapshot = {
  date: new Date().toISOString().slice(0, 10),
  followers: me.followers_count ?? null,
  posts: me.media_count ?? media.length,
  top: scored.slice(0, 3).map((s) => ({ day: s.day, eng: s.eng })),
  media: scored.map((s) => ({ day: s.day, likes: s.likes, comments: s.comments, eng: s.eng })),
};
history.push(snapshot);
writeFileSync(apath, JSON.stringify(history, null, 2) + "\n");

// learn: which voice / palette correlate with higher engagement
const byKey = (key) => {
  const agg = {};
  for (const s of scored) { if (!s[key]) continue; (agg[s[key]] ??= []).push(s.eng); }
  return Object.entries(agg)
    .map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length])
    .sort((a, b) => b[1] - a[1]);
};
const topVoice = byKey("voice")[0];
const topPalette = byKey("palette")[0];
const fGrowth = prev && prev.followers != null && me.followers_count != null
  ? me.followers_count - prev.followers : null;
const best = scored[0];

const log = `# 🤖 Growth Agent — ${snapshot.date}

**@${me.username}** · **${me.followers_count ?? "?"} followers**${fGrowth != null ? ` (${fGrowth >= 0 ? "+" : ""}${fGrowth} since last check)` : ""} · ${snapshot.posts} posts

## What's working
${best ? `- 🏆 Best reel so far: **Day ${best.day ?? "?"} — ${best.title ?? best.id}** (${best.likes} likes, ${best.comments} comments)` : "- No posts measured yet."}
${topVoice ? `- 🎙️ Highest-engagement voice: \`${topVoice[0]}\` (avg ${topVoice[1].toFixed(0)})` : ""}
${topPalette ? `- 🎨 Highest-engagement look: \`${topPalette[0]}\` (avg ${topPalette[1].toFixed(0)})` : ""}

## Recommendations (auto)
- Favor the **${topVoice ? topVoice[0] : "best"}** voice and **${topPalette ? topPalette[0] : "best"}** palette on upcoming reels.
- Double down on the angle of the top reel; consider a follow-up on the same idea.
- Keep hooks in the first 3s and the progress bar (retention drives reach more than timing).

## 💰 Paid-promo readiness
${(() => { const f = me.followers_count || 0;
  if (f >= 10000) return "- 🎯 **10k+** — add the bio link sticker, make a 1-page media kit, expect inbound brand DMs. Set a per-promo rate.";
  if (f >= 5000) return "- 🎯 **5k+** — you can start charging for shoutouts / affiliate promos. Sponsors weigh **engagement rate > follower count**, so keep saves & shares high.";
  if (f >= 1000) return "- 🎯 **1k+** — nano-influencer range: affiliate links + small paid shoutouts begin to work. Put a **contact email in your bio** so brands can reach you.";
  return "- 🎯 **Under 1k** — growth phase: maximize saves/shares & reach from the cold test-audience. Paid promos realistically start around ~1k+.";
})()}

## Full leaderboard
| Day | Likes | Comments | Score |
|----|------|---------|------|
${scored.map((s) => `| ${s.day ?? "?"} | ${s.likes} | ${s.comments} | ${s.eng} |`).join("\n")}

*Updated automatically. The agent measures and advises — it never buys, bots, or fakes engagement.*
`;
writeFileSync(join(ROOT, "AGENT_LOG.md"), log);
console.log(`Agent: ${me.followers_count ?? "?"} followers, ${media.length} posts measured. Wrote AGENT_LOG.md`);
