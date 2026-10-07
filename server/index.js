import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, tx } from './db.js';
import { createAuth, createLimiter } from './auth.js';
import { analyzePhoto, analyzeText, AnalysisError, PROMPT_VERSION } from './analyze.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, '..', 'public');
const PORT = Number(process.env.PORT || 3000);
const DAILY_LIMIT = Number(process.env.DAILY_ANALYSIS_LIMIT || 40);

if (process.env.MOCK_AI !== '1' && !process.env.ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set. Photo analysis will fail (set MOCK_AI=1 to test the UI).');
}

const db = openDb(process.env.DB_PATH || 'data/nutrition.db');
const auth = createAuth(db, {
  enrollCode: process.env.ENROLL_CODE,
  maxDevices: Number(process.env.MAX_DEVICES || 2),
});
const enrollLimiter = createLimiter({ windowMs: 15 * 60_000, max: 5 });
const burstLimiter = createLimiter({ windowMs: 60_000, max: 60 });

// ---------- helpers ----------

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function send(res, status, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function readJson(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new HttpError(413, 'too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

const clientIp = (req) => req.socket.remoteAddress || 'unknown';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const round1 = (n) => Math.round(n * 10) / 10;
const lang = (v) => (v === 'ro' ? 'ro' : 'en');

function finite(v, min, max, field) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `invalid_${field}`);
  return n;
}

// ---------- domain: meals ----------

const q = {
  analysesLast24h: db.prepare(
    "SELECT COUNT(*) AS n FROM analyses WHERE user_id = ? AND created_at > ? AND status = 'complete'"
  ),
  insertAnalysis: db.prepare(`INSERT INTO analyses
    (id, user_id, kind, status, model, prompt_version, input_text, result_json, error, latency_ms, input_tokens, output_tokens, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  getAnalysis: db.prepare('SELECT id FROM analyses WHERE id = ? AND user_id = ?'),
  getUser: db.prepare('SELECT id, display_name, goal_kcal FROM users WHERE id = ?'),
  setGoal: db.prepare('UPDATE users SET goal_kcal = ? WHERE id = ?'),
  mealByKey: db.prepare('SELECT id FROM meals WHERE user_id = ? AND idempotency_key = ?'),
  mealById: db.prepare('SELECT * FROM meals WHERE id = ? AND user_id = ?'),
  insertMeal: db.prepare(`INSERT INTO meals
    (id, user_id, analysis_id, meal_type, eaten_at, local_date, tz_offset_min, thumbnail, idempotency_key,
     kcal, protein, carbs, fat, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  updateMeal: db.prepare(`UPDATE meals SET meal_type = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, updated_at = ?
    WHERE id = ? AND user_id = ?`),
  deleteItems: db.prepare('DELETE FROM meal_items WHERE meal_id = ? AND user_id = ?'),
  insertItem: db.prepare(`INSERT INTO meal_items
    (meal_id, user_id, position, name, portion, grams, kcal_100g, protein_100g, carbs_100g, fat_100g,
     kcal, protein, carbs, fat, source, ai_name, ai_grams)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  deleteMeal: db.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?'),
  mealsForDate: db.prepare(`SELECT id, analysis_id, meal_type, eaten_at, local_date, thumbnail, kcal, protein, carbs, fat
    FROM meals WHERE user_id = ? AND local_date = ? ORDER BY eaten_at`),
  itemsForMeal: db.prepare(`SELECT name, portion, grams, kcal_100g, protein_100g, carbs_100g, fat_100g,
    kcal, protein, carbs, fat, source, ai_name, ai_grams FROM meal_items WHERE meal_id = ? ORDER BY position`),
  summary: db.prepare(`SELECT local_date AS date, COUNT(*) AS meals, SUM(kcal) AS kcal, SUM(protein) AS protein,
    SUM(carbs) AS carbs, SUM(fat) AS fat FROM meals WHERE user_id = ? AND local_date BETWEEN ? AND ?
    GROUP BY local_date ORDER BY local_date`),
};

// Nutrients are always computed on the server from grams x per-100 g density.
function buildItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new HttpError(400, 'no_items');
  if (rawItems.length > 30) throw new HttpError(400, 'too_many_items');
  return rawItems.map((it) => {
    const grams = finite(it.grams, 1, 5000, 'grams');
    const per = {
      kcal_100g: finite(it.kcal_100g, 0, 900, 'kcal'),
      protein_100g: finite(it.protein_100g, 0, 100, 'protein'),
      carbs_100g: finite(it.carbs_100g, 0, 100, 'carbs'),
      fat_100g: finite(it.fat_100g, 0, 100, 'fat'),
    };
    const name = String(it.name || '').trim().slice(0, 80);
    if (!name) throw new HttpError(400, 'invalid_name');
    const aiName = it.ai_name ? String(it.ai_name).slice(0, 80) : null;
    const aiGrams = it.ai_grams != null ? Number(it.ai_grams) : null;
    let source = 'manual';
    if (aiName) source = aiName === name && Math.abs((aiGrams ?? 0) - grams) < 0.5 ? 'ai' : 'ai_edited';
    return {
      name,
      portion: String(it.portion || '').slice(0, 60),
      grams,
      ...per,
      kcal: round1((grams * per.kcal_100g) / 100),
      protein: round1((grams * per.protein_100g) / 100),
      carbs: round1((grams * per.carbs_100g) / 100),
      fat: round1((grams * per.fat_100g) / 100),
      source,
      ai_name: aiName,
      ai_grams: aiGrams,
    };
  });
}

function totals(items) {
  const t = items.reduce(
    (a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return { kcal: round1(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

function writeItems(mealId, userId, items) {
  items.forEach((i, idx) =>
    q.insertItem.run(mealId, userId, idx, i.name, i.portion, i.grams, i.kcal_100g, i.protein_100g, i.carbs_100g,
      i.fat_100g, i.kcal, i.protein, i.carbs, i.fat, i.source, i.ai_name, i.ai_grams)
  );
}

function loadMeal(id, userId) {
  const m = q.mealById.get(id, userId);
  if (!m) return null;
  return { ...m, items: q.itemsForMeal.all(id) };
}

// ---------- routes ----------

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'POST /api/v1/enroll') {
    if (!enrollLimiter(clientIp(req))) throw new HttpError(429, 'too_many_attempts');
    const body = await readJson(req, 4_000);
    const r = auth.enroll(String(body.code || '').trim(), body.deviceName);
    if (r.error) throw new HttpError(r.status, r.error);
    return send(res, 201, { token: r.token });
  }

  const user = auth.authenticate(req);
  if (!user) throw new HttpError(401, 'unauthorized');
  if (!burstLimiter(`u${user.id}`)) throw new HttpError(429, 'slow_down');

  if (route === 'GET /api/v1/me') {
    const u = q.getUser.get(user.id);
    return send(res, 200, { goalKcal: u.goal_kcal, name: u.display_name, dailyAnalysisLimit: DAILY_LIMIT });
  }

  if (route === 'PATCH /api/v1/me') {
    const body = await readJson(req, 4_000);
    q.setGoal.run(Math.round(finite(body.goalKcal, 800, 6000, 'goal')), user.id);
    return send(res, 200, { ok: true });
  }

  if (route === 'POST /api/v1/analyses') {
    const body = await readJson(req, 8_000_000);
    const used = q.analysesLast24h.get(user.id, Date.now() - 86_400_000).n;
    if (used >= DAILY_LIMIT) throw new HttpError(429, 'daily_limit');

    const kind = body.text ? 'text' : 'photo';
    let input;
    if (kind === 'photo') {
      const m = String(body.image || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!m) throw new HttpError(400, 'invalid_image');
      input = { mediaType: m[1], imageBase64: m[2] };
    } else {
      input = { text: String(body.text).slice(0, 300) };
    }

    const id = crypto.randomUUID();
    const started = Date.now();
    try {
      const out = kind === 'photo'
        ? await analyzePhoto({ ...input, lang: lang(body.lang) })
        : await analyzeText({ ...input, lang: lang(body.lang) });
      q.insertAnalysis.run(id, user.id, kind, 'complete', out.model, PROMPT_VERSION, input.text ?? null,
        JSON.stringify(out.result), null, Date.now() - started, out.inputTokens, out.outputTokens, started);
      return send(res, 200, { id, ...out.result });
    } catch (err) {
      const code = err instanceof AnalysisError ? err.code : 'ai_unavailable';
      console.error(`[analysis ${id}] ${code}:`, err.message);
      q.insertAnalysis.run(id, user.id, kind, 'failed', null, PROMPT_VERSION, input.text ?? null, null,
        String(err.message).slice(0, 500), Date.now() - started, null, null, started);
      throw new HttpError(502, code);
    }
  }

  if (route === 'POST /api/v1/meals') {
    const body = await readJson(req, 200_000);
    const key = body.idempotencyKey ? String(body.idempotencyKey).slice(0, 64) : null;
    if (key) {
      const existing = q.mealByKey.get(user.id, key);
      if (existing) return send(res, 200, loadMeal(existing.id, user.id));
    }
    const items = buildItems(body.items);
    const t = totals(items);
    const mealType = MEAL_TYPES.includes(body.mealType) ? body.mealType : 'snack';
    if (!DATE_RE.test(body.localDate || '')) throw new HttpError(400, 'invalid_date');
    const eatenAt = finite(body.eatenAt ?? Date.now(), 0, Date.now() + 86_400_000, 'eaten_at');
    const analysisId = body.analysisId && q.getAnalysis.get(String(body.analysisId), user.id) ? String(body.analysisId) : null;
    const thumb = typeof body.thumbnail === 'string' && body.thumbnail.startsWith('data:image/jpeg;base64,')
      ? body.thumbnail.slice(0, 150_000) : null;
    const id = crypto.randomUUID();
    const now = Date.now();
    tx(db, () => {
      q.insertMeal.run(id, user.id, analysisId, mealType, eatenAt, body.localDate,
        Number.isFinite(body.tzOffsetMin) ? body.tzOffsetMin : null, thumb, key,
        t.kcal, t.protein, t.carbs, t.fat, now, now);
      writeItems(id, user.id, items);
    });
    return send(res, 201, loadMeal(id, user.id));
  }

  const mealMatch = url.pathname.match(/^\/api\/v1\/meals\/([0-9a-f-]{36})$/);
  if (mealMatch && req.method === 'PUT') {
    const body = await readJson(req, 200_000);
    if (!q.mealById.get(mealMatch[1], user.id)) throw new HttpError(404, 'not_found');
    const items = buildItems(body.items);
    const t = totals(items);
    const mealType = MEAL_TYPES.includes(body.mealType) ? body.mealType : 'snack';
    tx(db, () => {
      q.deleteItems.run(mealMatch[1], user.id);
      writeItems(mealMatch[1], user.id, items);
      q.updateMeal.run(mealType, t.kcal, t.protein, t.carbs, t.fat, Date.now(), mealMatch[1], user.id);
    });
    return send(res, 200, loadMeal(mealMatch[1], user.id));
  }
  if (mealMatch && req.method === 'DELETE') {
    q.deleteMeal.run(mealMatch[1], user.id);
    return send(res, 204);
  }

  const dayMatch = url.pathname.match(/^\/api\/v1\/days\/(\d{4}-\d{2}-\d{2})$/);
  if (dayMatch && req.method === 'GET') {
    const meals = q.mealsForDate.all(user.id, dayMatch[1]).map((m) => ({ ...m, items: q.itemsForMeal.all(m.id) }));
    return send(res, 200, { date: dayMatch[1], totals: totals(meals), meals });
  }

  if (route === 'GET /api/v1/summary') {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) throw new HttpError(400, 'invalid_range');
    return send(res, 200, { days: q.summary.all(user.id, from, to) });
  }

  throw new HttpError(404, 'not_found');
}

// ---------- static files ----------

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'");
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method_not_allowed' });
    return serveStatic(req, res, url);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.code });
    console.error(err);
    return send(res, 500, { error: 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`Daily Nutrition running on http://localhost:${PORT}`);
});
