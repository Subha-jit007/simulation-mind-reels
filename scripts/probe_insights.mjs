#!/usr/bin/env node
/**
 * probe_insights.mjs — find out exactly which metrics THIS token can read.
 *
 * The growth agent can only self-improve on signals Meta actually gives us.
 * Likes on a 36-follower account are noise; reach + watch time are the real
 * levers. Rather than guess which scopes the token has, we ask, one metric at
 * a time, and print a table of what worked.
 *
 * Run: node scripts/probe_insights.mjs      (env: IG_ACCESS_TOKEN)
 * Writes content/insights-capability.json so the agent can branch on it.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = process.env.GRAPH_VERSION || "v21.0";
const TOKEN = process.env.IG_ACCESS_TOKEN;
if (!TOKEN) { console.log("No IG_ACCESS_TOKEN — nothing to probe."); process.exit(0); }

const hosts = ["https://graph.instagram.com", "https://graph.facebook.com"];

async function call(host, path, params) {
  const q = new URLSearchParams({ ...params, access_token: TOKEN });
  const r = await fetch(`${host}/${V}/${path}?${q}`);
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !j.error, status: r.status, body: j };
}

const results = { probedAt: new Date().toISOString(), host: null, account: null, media: {}, accountMetrics: {}, mediaMetrics: {} };

// ---- 1. which host answers for this token -------------------------------
let host = null, me = null;
for (const h of hosts) {
  const r = await call(h, "me", { fields: "id,username,followers_count,media_count" });
  if (r.ok) { host = h; me = r.body; break; }
  console.log(`  ${h} /me → ${r.status} ${r.body?.error?.message || ""}`);
}
if (!host) { console.error("FAIL: token cannot even read /me on either host."); process.exit(1); }
results.host = host;
results.account = me;
console.log(`\n✓ host ${host}  ·  @${me.username}  ·  ${me.followers_count ?? "?"} followers  ·  ${me.media_count} posts\n`);

// ---- 2. newest reel to probe media-level insights against ---------------
const mediaRes = await call(host, "me/media", { fields: "id,media_type,media_product_type,timestamp,permalink", limit: "5" });
const reel = (mediaRes.body?.data || []).find((m) => m.media_product_type === "REELS") || (mediaRes.body?.data || [])[0];
if (reel) { results.media = reel; console.log(`probing media ${reel.id} (${reel.media_product_type || reel.media_type}) from ${reel.timestamp}\n`); }

// ---- 3. ACCOUNT-level metrics, one at a time ---------------------------
// Modern Graph requires metric_type=total_value for most account metrics.
const accountMetrics = [
  ["reach", { period: "days_28", metric_type: "total_value" }],
  ["views", { period: "days_28", metric_type: "total_value" }],
  ["profile_views", { period: "days_28", metric_type: "total_value" }],
  ["accounts_engaged", { period: "days_28", metric_type: "total_value" }],
  ["total_interactions", { period: "days_28", metric_type: "total_value" }],
  ["follows_and_unfollows", { period: "days_28", metric_type: "total_value" }],
  ["reach", { period: "day" }],
];
console.log("── ACCOUNT metrics ──");
for (const [metric, extra] of accountMetrics) {
  const r = await call(host, "me/insights", { metric, ...extra });
  const key = `${metric}:${extra.period}${extra.metric_type ? ":total_value" : ""}`;
  const val = r.ok ? (r.body.data?.[0]?.total_value?.value ?? r.body.data?.[0]?.values?.at(-1)?.value ?? "(empty)") : null;
  results.accountMetrics[key] = r.ok ? { ok: true, value: val } : { ok: false, error: r.body?.error?.message };
  console.log(`  ${r.ok ? "✓" : "✗"} ${key.padEnd(34)} ${r.ok ? val : (r.body?.error?.message || "").slice(0, 90)}`);
}

// ---- 4. MEDIA-level metrics (the retention signal we actually want) ----
const mediaMetrics = [
  "views", "reach", "likes", "comments", "saved", "shares", "total_interactions",
  "ig_reels_avg_watch_time", "ig_reels_video_view_total_time", "plays", "impressions",
];
if (reel) {
  console.log("\n── MEDIA metrics (newest reel) ──");
  for (const metric of mediaMetrics) {
    const r = await call(host, `${reel.id}/insights`, { metric });
    const val = r.ok ? (r.body.data?.[0]?.values?.[0]?.value ?? r.body.data?.[0]?.total_value?.value ?? "(empty)") : null;
    results.mediaMetrics[metric] = r.ok ? { ok: true, value: val } : { ok: false, error: r.body?.error?.message };
    console.log(`  ${r.ok ? "✓" : "✗"} ${metric.padEnd(34)} ${r.ok ? val : (r.body?.error?.message || "").slice(0, 90)}`);
  }
}

mkdirSync(join(ROOT, "content"), { recursive: true });
writeFileSync(join(ROOT, "content", "insights-capability.json"), JSON.stringify(results, null, 2) + "\n");

const okMedia = Object.entries(results.mediaMetrics).filter(([, v]) => v.ok).map(([k]) => k);
const okAcct = Object.entries(results.accountMetrics).filter(([, v]) => v.ok).map(([k]) => k);
console.log(`\n══ VERDICT ══`);
console.log(`account metrics readable: ${okAcct.length ? okAcct.join(", ") : "NONE"}`);
console.log(`media metrics readable:   ${okMedia.length ? okMedia.join(", ") : "NONE"}`);
const hasRetention = okMedia.some((m) => m.startsWith("ig_reels") || m === "views" || m === "reach");
console.log(hasRetention
  ? "→ RETENTION SIGNAL AVAILABLE. The self-improving loop can optimize on reach/watch-time."
  : "→ NO retention signal. Token needs insights scope re-auth before the loop can learn.");
