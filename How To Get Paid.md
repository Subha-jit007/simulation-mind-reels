# 💸 Money + the Growth Agent

The channel now has an **autonomous growth agent** and a **real product to sell**. Here's the whole money loop and the ONE thing only you can do.

## What runs on its own (free, no input)
- **Growth agent** (`.github/workflows/agent.yml` → `scripts/agent.mjs`): after each post it pulls follower count + per-reel likes/comments, appends to `content/analytics.json`, and writes **`AGENT_LOG.md`** — a plain-English report: what's winning, best voice/palette, and recommendations. It *measures and learns* — it never buys followers or fakes engagement (that bans accounts).
- **Caption monetization**: once you set your product link (below), every reel's caption auto-ends with a buy CTA.

## The product (already built, sitting in `product/` — local only)
- `product/simulation-mind-ebook.html` — the 51 ideas as a clean ebook. Open in a browser → **Print → Save as PDF** = your sellable PDF.
- `product/wallpapers/*.png` — 6 phone wallpapers (`Simulation & Mind` pack).
- Regenerate anytime: `node scripts/make_ebook.mjs` and `node scripts/make_wallpapers.mjs`.

## The ONE step only you can do (≈5 min) — money needs a home
A bot can't legally "get paid by itself" — payouts require an account tied to you. Do this once:
1. Make a **free Gumroad** (or Ko-fi / Lemon Squeezy) account.
2. Create a product: upload the **PDF ebook + the 6 wallpapers** (zip them). Price it (₹99 / $1–3 works for impulse buys), or "pay what you want."
3. Copy the product **link**.
4. Add it to the repo: **Settings → Secrets and variables → Actions → Variables → New variable**
   - `MONETIZE_URL` = your Gumroad link
   - *(optional)* `MONETIZE_CTA` = e.g. `📖 51 mind-benders + wallpapers →`
5. Put the same link in your **IG bio** (link in bio).

That's it. From then on every reel drives traffic to your product, automatically, and Gumroad pays out to you. No further input.

## How "viral" actually happens here
There's no switch. The system maximizes the real drivers — daily consistency, 3-second hooks, retention (progress bar + typed text), tight hashtags, good timing — and the agent doubles down on whatever the data says is working. Pair that with **saves/shares** (the wallpapers + ebook give people a reason to save & DM), and reach compounds. Patience + volume is the strategy; the automation just makes volume free.

## What it will NOT do (on purpose)
Mass-follow/like/comment bots, bought followers, engagement pods, fake views. All of it violates Instagram's rules and gets a young account **banned**. Refusing it is how we keep @philosophic_kid alive.
