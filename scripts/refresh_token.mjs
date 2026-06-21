#!/usr/bin/env node
/**
 * refresh_token.mjs — keeps the Instagram token alive forever.
 * Runs monthly: refreshes IG_ACCESS_TOKEN for another ~60 days and saves the
 * new value back into the repo secret (needs GH_PAT with Secrets:write).
 * The token is NEVER printed to logs.
 */
import { spawnSync } from "node:child_process";

const TOKEN = process.env.IG_ACCESS_TOKEN;
const PAT = process.env.GH_PAT;
const REPO = process.env.GITHUB_REPOSITORY;
if (!TOKEN) { console.error("No IG_ACCESS_TOKEN."); process.exit(1); }

const res = await fetch(
  `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(TOKEN)}`
);
const j = await res.json();
if (j.error || !j.access_token) {
  console.error("Refresh failed:", JSON.stringify(j.error || j));
  process.exit(1);
}
console.log(`✓ Token refreshed — valid ~${Math.round((j.expires_in || 0) / 86400)} more days.`);

if (!PAT) {
  console.log("⚠️ No GH_PAT secret set — can't save the new token automatically.");
  console.log("   Add a GH_PAT secret (see 'Automation Setup.md') to make this 100% hands-off.");
  process.exit(0);
}
// save the new token back into the secret via gh (value passed on stdin, never logged)
const r = spawnSync("gh", ["secret", "set", "IG_ACCESS_TOKEN", "--repo", REPO],
  { input: j.access_token, env: { ...process.env, GH_TOKEN: PAT }, stdio: ["pipe", "inherit", "inherit"] });
if (r.status !== 0) { console.error("Failed to update secret (check GH_PAT permissions)."); process.exit(1); }
console.log("✓ Saved the refreshed token to the IG_ACCESS_TOKEN secret. Nothing for you to do.");
