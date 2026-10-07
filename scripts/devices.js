// Admin helper:  npm run devices            -> list registered phones
//                npm run devices -- revoke 3  -> revoke phone #3 (frees a slot)
// Uses DATABASE_URL from .env when set (the online database), else the local SQLite file.
import { openDb } from '../server/db.js';

const db = await openDb();
const [cmd, id] = process.argv.slice(2);

if (cmd === 'revoke' && id) {
  const r = await db.run('UPDATE devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [Date.now(), Number(id)]);
  console.log(r.changes ? `Device ${id} revoked.` : `No active device ${id}.`);
} else {
  const rows = await db.all('SELECT id, user_id, name, created_at, last_seen_at, revoked_at FROM devices ORDER BY id');
  if (!rows.length) console.log('No devices registered yet.');
  const when = (ms) => (ms ? new Date(Number(ms)).toLocaleString() : '-');
  for (const r of rows) {
    console.log(`#${r.id}  user ${r.user_id}  ${r.revoked_at ? 'REVOKED' : 'active '}  added ${when(r.created_at)}  last seen ${when(r.last_seen_at)}\n     ${r.name}`);
  }
}
await db.close();
