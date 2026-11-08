import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createKey } from '../auth.js';
import { requireKey } from '../middleware/requireKey.js';
import { wrap } from '../middleware/errors.js';

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED' }
});

router.post('/register', registerLimiter, wrap(async (req, res) => {
  if (process.env.REGISTER_ENABLED === 'false') {
    return res.status(403).json({ error: 'REGISTER_DISABLED' });
  }
  const name = String((req.body && req.body.name) || '').slice(0, 80);
  const credits = parseInt(process.env.NEW_USER_CREDITS || '3600', 10);
  const out = await createKey({ name, credits });
  res.json({
    id: out.id,
    key: out.key,
    credits: out.credits,
    note: 'Simpan key ini. Tidak bisa dipulihkan.'
  });
}));

router.get('/me', requireKey, (req, res) => {
  const k = req.apiKey;
  res.json({
    id: k.id,
    name: k.name,
    plan: k.plan,
    credits: k.credits,
    prefix: k.key_prefix,
    lastUsed: k.last_used
  });
});

export default router;
