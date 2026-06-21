#!/usr/bin/env node
// Prints the next day number to render+post: lowest day that has a script and
// hasn't been posted yet (per content/state.json). Prints nothing if all done.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
const sp = join(ROOT, "content", "state.json");
const posted = existsSync(sp) ? (JSON.parse(readFileSync(sp, "utf8")).posted || []) : [];
const next = reels
  .filter((r) => r.script && r.script.trim())
  .map((r) => r.day)
  .sort((a, b) => a - b)
  .find((d) => !posted.includes(d));
if (next) process.stdout.write(String(next));
