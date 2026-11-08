import { verifyKey } from '../auth.js';

export async function requireKey(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'MISSING_API_KEY' });
    const key = await verifyKey(m[1].trim());
    if (!key) return res.status(401).json({ error: 'INVALID_API_KEY' });
    req.apiKey = key;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAdmin(req, res, next) {
  const provided = req.headers['x-admin-key'] || req.query.adminKey;
  if (!process.env.ADMIN_KEY || provided !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'ADMIN_ONLY' });
  }
  next();
}
