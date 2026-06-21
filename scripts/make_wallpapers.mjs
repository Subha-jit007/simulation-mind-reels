#!/usr/bin/env node
// Renders the sellable "Simulation & Mind" wallpaper pack from the studio.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STUDIO = join(ROOT, "studio");
mkdirSync(join(ROOT, "product", "wallpapers"), { recursive: true });

const PACK = [
  { n: "01-no-exit", line: "You can't escape a simulation from the inside.", palette: "void" },
  { n: "02-the-upload", line: "The upload isn't you. It's a copy that thinks it is.", palette: "signal" },
  { n: "03-the-ego", line: "The ego is a story you keep telling.", palette: "ember" },
  { n: "04-universe", line: "You are the universe, briefly awake.", palette: "void" },
  { n: "05-suffering", line: "Pain is the signal. Suffering is the story.", palette: "ember" },
  { n: "06-the-dream", line: "Even if it's a dream, it's where you live.", palette: "signal" },
];

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
for (const w of PACK) {
  writeFileSync(join(STUDIO, "_wp.json"), JSON.stringify({ line: w.line, palette: w.palette }));
  const out = `../product/wallpapers/${w.n}.png`;
  console.log(`▸ ${w.n}`);
  const r = spawnSync(npx, ["remotion", "still", "src/index.ts", "Wallpaper", out, "--props=_wp.json", "--log=error"],
    { cwd: STUDIO, shell: true, stdio: "inherit" });
  if (r.status !== 0) { console.error("failed:", w.n); process.exit(1); }
}
console.log("✓ wallpaper pack rendered to product/wallpapers/");
