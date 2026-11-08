import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initDb } from '../src/db.js';
import authRoutes from '../src/routes/auth.js';
import templateRoutes from '../src/routes/templates.js';
import exportRoutes from '../src/routes/export.js';
import { errorHandler, notFound } from '../src/middleware/errors.js';
import { requireAdmin } from '../src/middleware/requireKey.js';
import { q, now } from '../src/db.js';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? true
    : (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean),
  credentials: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

/* Init DB sekali per instance */
let initPromise = null;
app.use(async (req, res, next) => {
  try {
    if (!initPromise) initPromise = initDb();
    await initPromise;
    next();
  } catch (e) {
    initPromise = null;
    next(e);
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: now() }));
app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/admin/stats', requireAdmin, async (_req, res, next) => {
  try {
    const keys = (await q(`SELECT COUNT(*) c FROM api_keys`)).rows[0].c;
    const jobs = (await q(`SELECT status, COUNT(*) c FROM export_jobs GROUP BY status`)).rows;
    const secs = (await q(
      `SELECT COALESCE(SUM(duration_s),0) s FROM export_jobs WHERE status='completed'`
    )).rows[0].s;
    res.json({ keys, jobs, exportedSeconds: Math.round(secs) });
  } catch (e) { next(e); }
});

app.use(notFound);
app.use(errorHandler);

/* Untuk lokal: jalankan listen. Di Vercel, file ini diimpor sebagai handler. */
if (!process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, () => console.log(`[musiccard] listening on :${PORT}`));
}

export default app;
