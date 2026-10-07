import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Every user-owned table carries user_id from day one so the single-user MVP
// becomes multi-user by changing only how a user is authenticated.
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY,
  display_name TEXT,
  goal_kcal    INTEGER NOT NULL DEFAULT 2000,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  name         TEXT,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at   INTEGER
);

-- One row per AI call: raw output, model, prompt version, latency and tokens.
-- This is the audit trail for accuracy and cost.
CREATE TABLE IF NOT EXISTS analyses (
  id             TEXT PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
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
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_user_time ON analyses(user_id, created_at);

CREATE TABLE IF NOT EXISTS meals (
  id              TEXT PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  analysis_id     TEXT,
  meal_type       TEXT NOT NULL,
  eaten_at        INTEGER NOT NULL,        -- epoch ms (UTC)
  local_date      TEXT NOT NULL,           -- YYYY-MM-DD in the user's timezone at log time
  tz_offset_min   INTEGER,
  thumbnail       TEXT,
  idempotency_key TEXT,
  kcal            REAL NOT NULL DEFAULT 0,
  protein         REAL NOT NULL DEFAULT 0,
  carbs           REAL NOT NULL DEFAULT 0,
  fat             REAL NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, local_date);

-- Nutrient values are SNAPSHOTTED per item so history never changes silently.
-- ai_name / ai_grams keep what the AI originally said, to measure corrections.
CREATE TABLE IF NOT EXISTS meal_items (
  id           INTEGER PRIMARY KEY,
  meal_id      TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  position     INTEGER NOT NULL,
  name         TEXT NOT NULL,
  portion      TEXT,
  grams        REAL NOT NULL,
  kcal_100g    REAL NOT NULL,
  protein_100g REAL NOT NULL,
  carbs_100g   REAL NOT NULL,
  fat_100g     REAL NOT NULL,
  kcal         REAL NOT NULL,
  protein      REAL NOT NULL,
  carbs        REAL NOT NULL,
  fat          REAL NOT NULL,
  source       TEXT NOT NULL,              -- 'ai' | 'ai_edited' | 'manual'
  ai_name      TEXT,
  ai_grams     REAL
);
CREATE INDEX IF NOT EXISTS idx_items_meal ON meal_items(meal_id);
`;

export function openDb(file) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
