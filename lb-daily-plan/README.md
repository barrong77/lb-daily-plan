# LB & Sons — Daily Plan (Shared)

A shared web app for **Yvette and Julio** to build the morning crew plan together.
One person edits, the other sees it. When it's ready, it opens in Julio's Outlook
with the whole crew already in the To line — he reviews and hits **Send**.

Built from the real daily plans in Dropbox (`LB Mode Master/Plans`).

---

## What's in here

```
public/index.html        The app (the whole screen Yvette & Julio use)
functions/api/plan.js     The shared "notebook" — saves & shares the plan (Cloudflare)
wrangler.toml             Settings for deploying
```

The app talks to `/api/plan`, which stores the current plan in a Cloudflare **KV**
namespace so both people always see the same thing.

---

## How to put it online (about 15 minutes, one time)

You need a free **GitHub** account and a free **Cloudflare** account.

### Step 1 — Put the code on GitHub
1. Go to github.com → **New repository** → name it `lb-daily-plan` → **Create**.
2. Upload these files (drag the whole folder in), or push with git.

### Step 2 — Deploy with Cloudflare Pages
1. Go to **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**.
2. Pick your `lb-daily-plan` repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `public`
4. Click **Save and Deploy**. You'll get a web address like `lb-daily-plan.pages.dev`.

### Step 3 — Turn on sharing (the KV notebook)
1. Cloudflare dashboard → **Workers & Pages → KV → Create a namespace** → name it `PLAN_KV`.
2. Open your Pages project → **Settings → Functions → KV namespace bindings → Add binding**.
   - **Variable name:** `PLAN_KV`
   - **KV namespace:** the `PLAN_KV` you just made.
3. **Redeploy** (Deployments → Retry/Redeploy) so the binding takes effect.

### Step 4 — Use it
- Send Yvette and Julio the web address.
- Each taps their name at the top once.
- Build the plan → **Generate Plan** → **Open in Email** → Julio sends from Outlook.

That's it. Every change saves and shares automatically.

---

## Notes
- If two people edit the exact same second, the **last save wins**. A yellow bar tells
  you when the other person has a newer version so you can load it. For two people doing
  a morning plan, this is plenty.
- No logins to build. Anyone with the link can view/edit — keep the link inside the company.
  (If you want a password later, that's a small add-on.)
- Coming next (optional): pull each day's approved jobs straight from your Google Calendar
  so the job sites are already filled in when Yvette and Julio open it.
