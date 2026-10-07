import fs from 'node:fs';
import path from 'node:path';

// Storage adapter: Postgres when DATABASE_URL is set (production, e.g. a free
// Neon database), otherwise a local SQLite file (development). Queries are
// written once with `?` placeholders and work on both.
//
// Every user-owned table carries user_id from day one so the single-user MVP
// becomes multi-user by changing only how a user is authenticated.

const schema = (ID) => `
CREATE TABLE IF NOT EXISTS users (
  id           ${ID},
  display_name TEXT,
  goal_kcal    INTEGER NOT NULL DEFAULT 2000,
  created_at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id           ${ID},
  user_id      BIGINT NOT NULL REFERENCES users(id),
  name         TEXT,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   BIGINT NOT NULL,
  last_seen_at BIGINT,
  revoked_at   BIGINT
);

-- One row per AI call: raw output, model, prompt version, latency and tokens.
-- This is the audit trail for accuracy and cost.
CREATE TABLE IF NOT EXISTS analyses (
  id             TEXT PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  kind           TEXT NOT NULL,            -- 'photo' | 'text'
  status         TEXT NOT NULL,            -- 'complete' | 'failed'
  model          TEXT,
  prompt_version TEXT,
  input_text     TEXT,
  result_json    TEXT,
  error          TEXT,
  latency_ms     INTEGER,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  created_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_user_time ON analyses(user_id, created_at);

CREATE TABLE IF NOT EXISTS meals (
  id              TEXT PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  analysis_id     TEXT,
  meal_type       TEXT NOT NULL,
  eaten_at        BIGINT NOT NULL,         -- epoch ms (UTC)
  local_date      TEXT NOT NULL,           -- YYYY-MM-DD in the user's timezone at log time
  tz_offset_min   INTEGER,
  thumbnail       TEXT,
  idempotency_key TEXT,
  kcal            DOUBLE PRECISION NOT NULL DEFAULT 0,
  protein         DOUBLE PRECISION NOT NULL DEFAULT 0,
  carbs           DOUBLE PRECISION NOT NULL DEFAULT 0,
  fat             DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, local_date);

-- Nutrient values are SNAPSHOTTED per item so history never changes silently.
-- ai_name / ai_grams keep what the AI originally said, to measure corrections.
CREATE TABLE IF NOT EXISTS meal_items (
  id           ${ID},
  meal_id      TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL REFERENCES users(id),
  position     INTEGER NOT NULL,
  name         TEXT NOT NULL,
  portion      TEXT,
  grams        DOUBLE PRECISION NOT NULL,
  kcal_100g    DOUBLE PRECISION NOT NULL,
  protein_100g DOUBLE PRECISION NOT NULL,
  carbs_100g   DOUBLE PRECISION NOT NULL,
  fat_100g     DOUBLE PRECISION NOT NULL,
  kcal         DOUBLE PRECISION NOT NULL,
  protein      DOUBLE PRECISION NOT NULL,
  carbs        DOUBLE PRECISION NOT NULL,
  fat          DOUBLE PRECISION NOT NULL,
  source       TEXT NOT NULL,              -- 'ai' | 'ai_edited' | 'manual'
  ai_name      TEXT,
  ai_grams     DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS idx_items_meal ON meal_items(meal_id);
`;

export async function openDb() {
  return process.env.DATABASE_URL ? openPostgres(process.env.DATABASE_URL) : openSqlite(process.env.DB_PATH || 'data/nutrition.db');
}

async function openPostgres(url) {
  const { default: pg } = await import('pg');
  // BIGINT (epoch ms, ids, COUNT) arrives as a string by default; all our values fit in a JS number.
  pg.types.setTypeParser(20, (v) => Number(v));
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  });
  const toPg = (sql) => {
    let n = 0;
    return sql.replace(/\?/g, () => `$${++n}`);
  };
  const wrap = (runner) => ({
    all: async (sql, params = []) => (await runner.query(toPg(sql), params)).rows,
    get: async (sql, params = []) => (await runner.query(toPg(sql), params)).rows[0],
    run: async (sql, params = []) => ({ changes: (await runner.query(toPg(sql), params)).rowCount }),
  });

  await pool.query(schema('BIGSERIAL PRIMARY KEY'));
  return {
    kind: 'postgres',
    ...wrap(pool),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrap(client));
        await client.query('COMMIT');
        return out;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function openSqlite(file) {
  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(schema('INTEGER PRIMARY KEY'));
  const cache = new Map();
  const stmt = (sql) => {
    if (!cache.has(sql)) cache.set(sql, db.prepare(sql));
    return cache.get(sql);
  };
  const api = {
    all: async (sql, params = []) => stmt(sql).all(...params),
    get: async (sql, params = []) => stmt(sql).get(...params),
    run: async (sql, params = []) => ({ changes: Number(stmt(sql).run(...params).changes) }),
  };
  let queue = Promise.resolve();
  return {
    kind: 'sqlite',
    ...api,
    // Serialize transactions: one SQLite connection can't interleave them.
    tx(fn) {
      const next = queue.then(async () => {
        db.exec('BEGIN');
        try {
          const out = await fn(api);
          db.exec('COMMIT');
          return out;
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      });
      queue = next.catch(() => {});
      return next;
    },
    close: async () => db.close(),
  };
}
