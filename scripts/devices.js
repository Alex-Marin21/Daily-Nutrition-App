// Admin helper:  npm run devices            -> list registered phones
//                npm run devices -- revoke 3  -> revoke phone #3 (frees a slot)
import { openDb } from '../server/db.js';

const db = openDb(process.env.DB_PATH || 'data/nutrition.db');
const [cmd, id] = process.argv.slice(2);

if (cmd === 'revoke' && id) {
  const r = db.prepare('UPDATE devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(Date.now(), Number(id));
  console.log(r.changes ? `Device ${id} revoked.` : `No active device ${id}.`);
} else {
  const rows = db.prepare('SELECT id, user_id, name, created_at, last_seen_at, revoked_at FROM devices ORDER BY id').all();
  if (!rows.length) console.log('No devices registered yet.');
  for (const r of rows) {
    const when = (ms) => (ms ? new Date(ms).toLocaleString() : '-');
    console.log(`#${r.id}  user ${r.user_id}  ${r.revoked_at ? 'REVOKED' : 'active '}  added ${when(r.created_at)}  last seen ${when(r.last_seen_at)}\n     ${r.name}`);
  }
}
