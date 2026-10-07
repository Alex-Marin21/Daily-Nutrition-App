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

He needs a stable HTTPS address. Any host that runs Docker and has a persistent disk works:

1. Push this folder to a private Git repository.
2. Create a web service from the `Dockerfile` (e.g. Render, Railway, Fly.io, or any VPS).
3. Attach a persistent disk/volume at `/app/data`. Without one, meals are lost on every redeploy.
4. Set the environment variables from the table above in the host's dashboard. Use `MOCK_AI=0`, and never commit `.env`.
5. Open the HTTPS address on his phone, type the access code once, then:
   - **iPhone (Safari):** Share → *Add to Home Screen*
   - **Android (Chrome):** menu ⋮ → *Add to Home screen* / *Install app*

## Managing phones

```bash
npm run devices              # list registered phones
npm run devices -- revoke 2  # remove phone #2 (frees a slot)
```

If he changes phones or clears the browser, revoke the old one and he enters the code again.

## Cost

Each photo is one Claude request (`claude-opus-5-5`, about 2–3k tokens in plus the response). Typing a food also counts as one request. `DAILY_ANALYSIS_LIMIT` caps daily usage. Also set a monthly spend limit in the Anthropic Console.

## Checking AI accuracy

All data is in `data/nutrition.db` (SQLite). For example, the share of foods logged without changes:

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
