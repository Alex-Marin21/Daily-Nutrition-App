# Daily Calories

**Live:** https://daily-nutrition-app.vercel.app

Take a photo of a meal → get calories, protein, carbs and fat → adjust if needed → log it → see the day's total.

Works on iPhone and Android as a web app you add to the Home Screen (no App Store needed for the beta).

## What's inside

```
server/
  index.js    API + serves the app (no framework)
  auth.js     one-time access code → per-device token; rate limiting
  analyze.js  AI vision call: Gemini or Claude (the only file that talks to the AI)
  db.js       SQLite schema (built into Node, nothing to install)
public/       the phone app (HTML/CSS/JS, installable PWA)
scripts/      icon generator, device admin
```

How a photo becomes a logged meal:

1. The phone shrinks the photo (~1280 px JPEG) and sends it with the device token.
2. The server checks the token and the daily limit, then asks the AI (Gemini by default, or Claude) to identify each food, estimate grams, and give **per-100 g** nutrition values.
3. The phone multiplies grams × per-100 g values, so portion changes update instantly with no network call.
4. "Log meal" sends the final items. The server recomputes all totals itself and stores both what the AI said (`ai_name`, `ai_grams`) and what was logged, so you can measure how accurate the AI is.

## Run it on this computer

Requires Node.js 22.13 or newer (installed: 24).

```bash
npm install
```

Copy `.env.example` to `.env` (one has already been created for local testing) and set:

| Setting | What it is |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key from aistudio.google.com/apikey |
| `AI_PROVIDER` | `gemini` (default when a Gemini key is set) or `claude` (then set `ANTHROPIC_API_KEY`) |
| `ENROLL_CODE` | The code your father types once on his phone. Long and random. |
| `MOCK_AI` | `1` = fake results (UI testing), `0` = real AI |
| `DAILY_ANALYSIS_LIMIT` | Max photo/text analyses per 24 h (cost safety) |
| `MAX_DEVICES` | How many phones can register (default 2) |

```bash
npm start
```

Open http://localhost:3000.

**Try it from a phone on the same Wi-Fi:** open `http://<this-PC's-IP>:3000`. Find the IP with `ipconfig`. Windows Firewall may ask to allow Node; allow it on private networks. The camera button works over plain HTTP. Installing as an app and offline mode need HTTPS (see below).

## Put it online for your father (HTTPS)

Free setup: **Vercel** (free hosting) + **Neon** (free Postgres database). No card needed.

1. **Neon** (neon.tech): sign up → create a project → copy the **connection string** (`postgresql://...`).
2. **Vercel** (vercel.com): sign in with GitHub → **Add New… → Project** → import this repository. Leave the build settings as they are (`vercel.json` configures them).
3. Before clicking Deploy, open **Environment Variables** and add `DATABASE_URL` (the Neon string), `GEMINI_API_KEY`, `ENROLL_CODE`, `AI_PROVIDER` = `gemini`, and `MOCK_AI` = `0`.
4. Click **Deploy**, then open the `https://….vercel.app` address on his phone, type the access code once, then:
   - **iPhone (Safari):** Share → *Add to Home Screen*
   - **Android (Chrome):** menu ⋮ → *Add to Home screen* / *Install app*

On Vercel, `api/index.js` runs the app as a serverless function and the `public/` folder is served directly.

Alternatives: `render.yaml` (Render free plan: sleeps after 15 min idle, so the first open takes 30–60 s) or the `Dockerfile` (any Docker host).

Storage: with `DATABASE_URL` set the app uses Postgres; without it, a local SQLite file (`data/nutrition.db`).

## Managing phones

```bash
npm run devices              # list registered phones
npm run devices -- revoke 2  # remove phone #2 (frees a slot)
```

If he changes phones or clears the browser, revoke the old one and he enters the code again. To manage the online database from this PC, put the Neon `DATABASE_URL` in your local `.env` first.

## Cost

Each photo or typed food is one AI request. With Gemini (`gemini-3.8-flash`) the API free tier covers normal use, but on the free tier Google may use the photos to improve its products; enabling billing on the key avoids that (about $0.002 per photo). Gemini sometimes answers "high demand"; the app retries automatically. `DAILY_ANALYSIS_LIMIT` caps daily usage.

## Checking AI accuracy

Online, the data is in Neon; you can run these in Neon's **SQL Editor**. For example, the share of foods logged without changes:

```sql
SELECT source, COUNT(*) FROM meal_items GROUP BY source;   -- ai / ai_edited / manual
SELECT name, ai_name, ai_grams, grams FROM meal_items WHERE source = 'ai_edited';
```

## Path to the App Store (phase 2)

These parts are already shaped for it:
- Every table has `user_id`.
- Login lives in one module (`auth.js`).
- The AI lives in one module (`analyze.js`).
- The API is versioned (`/api/v1`).
- Nutrients are snapshotted per meal.

What would change for phase 2:
- Replace the access code with real accounts (Sign in with Apple/Google).
- Move from SQLite to a hosted database.
- Wrap or rebuild the front end as a native app.
- Add account deletion and privacy labels.
