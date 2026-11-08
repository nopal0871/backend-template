import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { q, now } from './db.js';

export function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function createKey({ name = '', credits = 3600 } = {}) {
  const raw = 'mc_' + nanoid(32);
  const id = 'key_' + nanoid(12);
  await q(
    `INSERT INTO api_keys (id, key_hash, key_prefix, name, credits, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, hashKey(raw), raw.slice(0, 10), name, credits, now()]
  );
  return { id, key: raw, credits };
}

export async function verifyKey(raw) {
  if (!raw || !raw.startsWith('mc_')) return null;
  const rs = await q(
    `SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0`,
    [hashKey(raw)]
  );
  const row = rs.rows[0];
  if (!row) return null;
  await q(`UPDATE api_keys SET last_used = ? WHERE id = ?`, [now(), row.id]);
  return row;
}
