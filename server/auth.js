import crypto from 'node:crypto';

// Two ways in, both ending in the same thing: a random per-device bearer token
// (only its hash is stored), so everything downstream only sees `req.user.id`.
//  1. Google sign-in through Supabase Auth: anyone can create an account.
//  2. An access code (optional, ENROLL_CODE) that binds a device to user #1.

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function safeEqual(a, b) {
  const ha = Buffer.from(sha256(String(a)));
  const hb = Buffer.from(sha256(String(b)));
  return crypto.timingSafeEqual(ha, hb);
}

export function createAuth(db, { enrollCode, maxDevices, supabaseUrl, supabaseKey }) {
  async function issueToken(q, userId, deviceName) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    await q.run(
      'INSERT INTO devices (user_id, name, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
      [userId, String(deviceName || 'phone').slice(0, 80), sha256(token), now, now]
    );
    return token;
  }

  // The phone got a Supabase session after Google sign-in. Ask Supabase who it
  // belongs to (this also checks it's genuine and not expired), then find or
  // create our own user for that account.
  async function signInWithSupabase(accessToken, deviceName) {
    if (!supabaseUrl || !supabaseKey) return { error: 'server_not_configured', status: 503 };
    if (typeof accessToken !== 'string' || accessToken.length < 20 || accessToken.length > 8000) {
      return { error: 'invalid_login', status: 400 };
    }
    let res;
    try {
      res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { error: 'auth_unavailable', status: 502 };
    }
    if (res.status === 401 || res.status === 403) return { error: 'invalid_login', status: 401 };
    if (!res.ok) return { error: 'auth_unavailable', status: 502 };
    const account = await res.json();
    if (!account?.id) return { error: 'invalid_login', status: 401 };

    const email = account.email ? String(account.email).toLowerCase().slice(0, 200) : null;
    const meta = account.user_metadata || {};
    const name = String(meta.full_name || meta.name || email || 'User').slice(0, 80);
    const token = await db.tx(async (q) => {
      let link = await q.get("SELECT user_id FROM identities WHERE provider = 'supabase' AND subject = ?", [account.id]);
      if (!link) {
        const now = Date.now();
        const user = await q.get('INSERT INTO users (display_name, created_at) VALUES (?, ?) RETURNING id', [name, now]);
        await q.run(
          "INSERT INTO identities (provider, subject, user_id, email, created_at) VALUES ('supabase', ?, ?, ?, ?)",
          [account.id, user.id, email, now]
        );
        link = { user_id: user.id };
      }
      return issueToken(q, link.user_id, deviceName);
    });
    return { token };
  }

  async function signOut(deviceId) {
    await db.run('UPDATE devices SET revoked_at = ? WHERE id = ?', [Date.now(), deviceId]);
  }

  async function enroll(code, deviceName) {
    if (!enrollCode || enrollCode.length < 8) {
      return { error: 'server_not_configured', status: 503 };
    }
    if (!safeEqual(code || '', enrollCode)) return { error: 'invalid_code', status: 401 };
    // The access code opens one dedicated account (never a Google user's), with a capped phone count.
    return db.tx(async (q) => {
      const link = await q.get("SELECT user_id FROM identities WHERE provider = 'code' AND subject = 'owner'");
      let userId = link?.user_id;
      if (userId) {
        const { n } = await q.get('SELECT COUNT(*) AS n FROM devices WHERE user_id = ? AND revoked_at IS NULL', [userId]);
        if (n >= maxDevices) return { error: 'device_limit', status: 403 };
      } else {
        const now = Date.now();
        userId = (await q.get('INSERT INTO users (display_name, created_at) VALUES (?, ?) RETURNING id', ['Beta tester', now])).id;
        await q.run("INSERT INTO identities (provider, subject, user_id, created_at) VALUES ('code', 'owner', ?, ?)", [userId, now]);
      }
      return { token: await issueToken(q, userId, deviceName), userId };
    });
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

  return { enroll, signInWithSupabase, signOut, authenticate };
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
