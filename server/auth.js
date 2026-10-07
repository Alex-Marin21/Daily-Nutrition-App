import crypto from 'node:crypto';

// MVP identity: a one-time enrollment code binds a device to user #1 and issues
// a random bearer token (only its hash is stored). Phase 2 swaps this module for
// a real sign-in provider; everything downstream only sees `req.user.id`.

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function safeEqual(a, b) {
  const ha = Buffer.from(sha256(String(a)));
  const hb = Buffer.from(sha256(String(b)));
  return crypto.timingSafeEqual(ha, hb);
}

export function createAuth(db, { enrollCode, maxDevices }) {
  async function enroll(code, deviceName) {
    if (!enrollCode || enrollCode.length < 8) {
      return { error: 'server_not_configured', status: 503 };
    }
    if (!safeEqual(code || '', enrollCode)) return { error: 'invalid_code', status: 401 };
    const { n } = await db.get('SELECT COUNT(*) AS n FROM devices WHERE revoked_at IS NULL');
    if (n >= maxDevices) return { error: 'device_limit', status: 403 };

    const now = Date.now();
    let user = await db.get('SELECT id FROM users ORDER BY id LIMIT 1');
    if (!user) {
      user = await db.get('INSERT INTO users (display_name, created_at) VALUES (?, ?) RETURNING id', ['Beta tester', now]);
    }
    const token = crypto.randomBytes(32).toString('base64url');
    await db.run(
      'INSERT INTO devices (user_id, name, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, String(deviceName || 'phone').slice(0, 80), sha256(token), now, now]
    );
    return { token, userId: user.id };
  }

  async function authenticate(req) {
    const header = req.headers.authorization || '';
    const m = header.match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/);
    if (!m) return null;
    const device = await db.get(
      'SELECT id, user_id FROM devices WHERE token_hash = ? AND revoked_at IS NULL',
      [sha256(m[1])]
    );
    if (!device) return null;
    db.run('UPDATE devices SET last_seen_at = ? WHERE id = ?', [Date.now(), device.id]).catch(() => {});
    return { id: device.user_id, deviceId: device.id };
  }

  return { enroll, authenticate };
}

// Small in-memory fixed-window limiter, keyed by anything (IP, user id).
export function createLimiter({ windowMs, max }) {
  const hits = new Map();
  return function allow(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}
