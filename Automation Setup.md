# 🤖 Auto-Posting Setup (100% free, one-time ~15 min)

Once this is done, a free daily robot posts the next rendered reel to your IG by itself.
You never touch it again. No subscriptions, no paid API keys.

**How it works:** a **GitHub Actions** cron runs once a day → it **renders** the next reel on a
free cloud machine → uploads it as a **GitHub Release** asset → tells **Meta's free Graph API** to
publish it with its caption + hashtags. Your PC can be off. All 51 scripts are pre-written, so it
never needs any paid AI.

---

## Part 1 — Instagram + Facebook (on your new account)
1. Create the new IG account in the app.
2. Make it **Professional**: Settings → *Account type and tools* → **Switch to professional account** → choose **Creator**.
3. Create a **Facebook Page** (free): facebook.com → Pages → Create → name it the same brand.
4. Link them: on the IG app → Settings → *Accounts Center* (or Page settings → Linked accounts) → **connect the Facebook Page to the Instagram account**.

## Part 2 — Meta developer app + token (the part that gives us the keys)
1. Go to **developers.facebook.com** → log in with the Facebook account that owns the Page → **My Apps → Create App** → type **Business** → name it (e.g. "sim-mind-poster").
2. In the app: **Add Product → Instagram → Graph API** (a.k.a. "Instagram with Facebook Login").
3. Open **Tools → Graph API Explorer**:
   - Select your app (top right).
   - **Add permissions:** `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`.
   - Click **Generate Access Token** → approve the popup (select your Page + IG account).
4. Get the long-lived, effectively **non-expiring** token (so it never breaks):
   - In Explorer, run `GET me/accounts` → copy the **`access_token`** of your Page (this Page token doesn't expire as long as permissions stay).
   - Run `GET me/accounts?fields=instagram_business_account,name` → copy the **`instagram_business_account.id`** — that's your **IG_USER_ID**.

> 🔐 You now have two values: **IG_USER_ID** (a number) and **IG_ACCESS_TOKEN** (the Page token).
> Keep them private. You can paste them to me and I'll wire them, or add them as GitHub secrets (below).

## Part 3 — GitHub (free host + free scheduler)
1. Create a **free GitHub account** if you don't have one.
2. Create a **PUBLIC** repo (public = free unlimited Actions + public MP4 URLs Instagram can read).
3. Push this folder to it (I can do this for you):
   ```bash
   cd "E:\ig contetnt"
   git init && git add . && git commit -m "sim-mind reel studio"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
4. In the repo → **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `IG_USER_ID` = your IG_USER_ID
   - `IG_ACCESS_TOKEN` = your Page token
5. Set the time: edit `.github/workflows/daily-reel.yml` → the `cron:` line (it's in **UTC**).
   Example: 8:00 PM IST = `30 14 * * *`.

## Part 4 — test it
- Repo → **Actions** tab → **Daily IG Reel** → **Run workflow** (manual trigger).
- It should publish Day 1 to your IG within a minute or two. 🎉
- After that, it runs automatically every day and posts the next un-posted reel.

---

## Make it TRULY zero-touch (token auto-refresh) — optional, one-time
IG tokens expire ~60 days. To never re-paste again, let the repo refresh its own token:
1. GitHub → your avatar → **Settings → Developer settings → Personal access tokens → Tokens (classic)** → **Generate new token (classic)**.
   - Note: `reel-token-refresher` · Expiration: **No expiration** (or 1 year) · Scope: tick **`repo`** → Generate → copy.
   - *(Fine-grained alternative: only-this-repo, Repository permissions → Secrets: Read and write.)*
2. Repo → **Settings → Secrets and variables → Actions → New repository secret** → name **`GH_PAT`**, paste the token.
3. Done. The **Refresh IG Token** workflow runs monthly and updates `IG_ACCESS_TOKEN` itself — you never touch it again.
   (Test it now: Actions tab → **Refresh IG Token** → Run workflow.)

## Notes
- **Fully automatic:** each day it renders the next un-posted day (1 → 51) and posts it. No buffer
  to maintain, nothing to render by hand. All 51 scripts/captions/hashtags are already written.
- **Order/skip:** `content/state.json` tracks what's posted (no double-posts). Force a specific day
  from the Actions tab → Run workflow → "day".
- **Pacing tip:** for a brand-new account, change the cron to every other day for the first ~2 weeks
  (e.g. `30 14 */2 * *`), then daily.
- **Change content anytime:** edit `content/reels.json` (script/caption/hashtags/voice) and push.
- **Private repo instead?** Release asset URLs need a public repo. Want private? Tell me and I'll
  switch hosting to Cloudflare R2 (also free).
- **Local dry-run** (no posting): `DRY_RUN=1 node scripts/publish_ig.mjs 1`
