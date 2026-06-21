#!/usr/bin/env node
// Compiles the 51 ideas into a themed, sellable ebook (single HTML; print to PDF).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reels = JSON.parse(readFileSync(join(ROOT, "content", "reels.json"), "utf8"));
mkdirSync(join(ROOT, "product"), { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const entries = reels.map((r) => `
  <section class="entry">
    <div class="num">${String(r.day).padStart(2, "0")} / 51</div>
    <h2>${esc(r.title)}</h2>
    <p class="idea">${esc(r.idea || "")}</p>
    <p class="body">${esc(r.script || "")}</p>
  </section>`).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Simulation &amp; Mind — 51 Questions That Don't Let You Sleep</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Silkscreen&display=swap" rel="stylesheet">
<style>
  :root{--bg:#0b0c10;--ink:#F0EEE6;--accent:#DA7756;--dim:#8a8a86}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'IBM Plex Mono',monospace;line-height:1.6}
  .wrap{max-width:760px;margin:0 auto;padding:80px 40px}
  .cover{min-height:90vh;display:flex;flex-direction:column;justify-content:center;border-bottom:2px solid var(--accent)}
  .kick{font-family:'Silkscreen';color:var(--accent);letter-spacing:2px;font-size:14px}
  h1{font-size:46px;line-height:1.2;margin:18px 0}
  .sub{color:var(--dim)}
  .entry{padding:48px 0;border-bottom:1px solid rgba(255,255,255,.08)}
  .num{font-family:'Silkscreen';color:var(--accent);font-size:13px;letter-spacing:2px}
  h2{font-size:30px;margin:10px 0 14px}
  .idea{color:var(--accent);font-style:italic;margin:0 0 16px}
  .body{font-size:18px}
  .handle{color:var(--accent)}
  @media print{body{background:#fff;color:#111}.cover{border-color:#DA7756}.entry{border-color:#ddd}.idea,.num,.kick,.handle{color:#b85c3c}}
</style></head>
<body><div class="wrap">
  <div class="cover">
    <div class="kick">&gt; philosophic_kid // transmission archive</div>
    <h1>Simulation &amp; Mind</h1>
    <p class="sub">51 questions that don't let you sleep — on simulation, consciousness, the self, and what "real" even means.</p>
    <p class="sub">Follow <span class="handle">@philosophic_kid</span> for a new one every day.</p>
  </div>
  ${entries}
  <section class="entry"><p class="sub">© philosophic_kid · share the questions, not the file.</p></section>
</div></body></html>`;

writeFileSync(join(ROOT, "product", "simulation-mind-ebook.html"), html);
console.log("✓ ebook written to product/simulation-mind-ebook.html (open in a browser → Print → Save as PDF)");
