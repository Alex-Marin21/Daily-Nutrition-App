# Daily Calories

Take a photo of a meal → get calories, protein, carbs and fat → adjust if needed → log it → see the day's total.

Works on iPhone and Android as a web app you add to the Home Screen (no App Store needed for the beta).

## What's inside

```
server/
  index.js    API + serves the app (no framework)
  auth.js     one-time access code → per-device token; rate limiting
  analyze.js  Claude vision call (the only file that talks to the AI)
  db.js       SQLite schema (built into Node, nothing to install)
public/       the phone app (HTML/CSS/JS, installable PWA)
scripts/      icon generator, device admin
```

How a photo becomes a logged meal:

1. The phone shrinks the photo (~1280 px JPEG) and sends it with the device token.
2. The server checks the token and the daily limit, then asks Claude to identify each food, estimate grams, and give **per-100 g** nutrition values.
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
| `ANTHROPIC_API_KEY` | Your Claude API key from console.anthropic.com |
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

Free setup: **Render** (free web service) + **Neon** (free Postgres database). No card needed.

1. **Neon** (neon.tech): sign up → create a project → copy the **connection string** (`postgresql://...`).
2. **Render** (render.com): sign in with GitHub → **New + → Blueprint** → pick this repository. It reads `render.yaml`.
3. Fill in the three values Render asks for: `DATABASE_URL` (the Neon string), `ANTHROPIC_API_KEY`, `ENROLL_CODE`.
4. Wait for **Live**, then open the `https://….onrender.com` address on his phone, type the access code once, then:
   - **iPhone (Safari):** Share → *Add to Home Screen*
   - **Android (Chrome):** menu ⋮ → *Add to Home screen* / *Install app*

The free server sleeps after ~15 minutes without visits, so the first open after a break takes 30–60 seconds (the app shows a "Starting up…" message). Meals are safe in the database.

Storage: with `DATABASE_URL` set the app uses Postgres; without it, a local SQLite file (`data/nutrition.db`). Any Docker host works too.

## Managing phones

```bash
npm run devices              # list registered phones
npm run devices -- revoke 2  # remove phone #2 (frees a slot)
```

If he changes phones or clears the browser, revoke the old one and he enters the code again. To manage the online database from this PC, put the Neon `DATABASE_URL` in your local `.env` first.

## Cost

Each photo is one Claude request (`claude-opus-5-5`, about 2–3k tokens in plus the response). Typing a food also counts as one request. `DAILY_ANALYSIS_LIMIT` caps daily usage. Also set a monthly spend limit in the Anthropic Console.

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
