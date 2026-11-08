import { createClient } from '@libsql/client/web';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

let initialized = false;

export async function initDb() {
  if (initialized) return;
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS api_keys (
        id          TEXT PRIMARY KEY,
        key_hash    TEXT NOT NULL UNIQUE,
        key_prefix  TEXT NOT NULL,
        name        TEXT NOT NULL DEFAULT '',
        plan        TEXT NOT NULL DEFAULT 'free',
        credits     INTEGER NOT NULL DEFAULT 0,
        revoked     INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        last_used   INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`,
      `CREATE TABLE IF NOT EXISTS templates (
        id          TEXT PRIMARY KEY,
        key_id      TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        config      TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_templates_key ON templates(key_id)`,
      `CREATE TABLE IF NOT EXISTS export_jobs (
        id            TEXT PRIMARY KEY,
        key_id        TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        template_id   TEXT,
        status        TEXT NOT NULL DEFAULT 'pending',
        duration_s    REAL NOT NULL,
        format        TEXT NOT NULL DEFAULT 'mp4',
        credits_used  INTEGER NOT NULL,
        size_bytes    INTEGER,
        error         TEXT,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_key ON export_jobs(key_id)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_status ON export_jobs(status, updated_at)`,
      `CREATE TABLE IF NOT EXISTS usage_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id     TEXT NOT NULL,
        action     TEXT NOT NULL,
        meta       TEXT,
        ts         INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_usage_key_ts ON usage_log(key_id, ts)`
    ],
    'write'
  );
  initialized = true;
}

export { client };
export const now = () => Date.now();

/* Helper query */
export async function q(sql, args = []) {
  const rs = await client.execute({ sql, args });
  return rs;
}
