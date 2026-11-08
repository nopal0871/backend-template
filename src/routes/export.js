import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import { client, q, now } from '../db.js';
import { requireKey } from '../middleware/requireKey.js';
import { ExportRequest } from '../schemas.js';
import { wrap } from '../middleware/errors.js';

const router = Router();
router.use(requireKey);

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: req => req.apiKey.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED' }
});

router.post('/request', exportLimiter, wrap(async (req, res) => {
  const { duration, format, templateId } = ExportRequest.parse(req.body);
  const credits = Math.ceil(duration);
  const keyId = req.apiKey.id;

  /* Cek kredit dulu */
  const cur = await q(`SELECT credits FROM api_keys WHERE id = ?`, [keyId]);
  const balance = cur.rows[0]?.credits ?? 0;
  if (balance < credits) {
    return res.status(402).json({ error: 'INSUFFICIENT_CREDITS', balance, needed: credits });
  }

  /* Deduct + insert job */
  const jobId = 'job_' + nanoid(16);
  const t = now();
  await client.batch(
    [
      { sql: `UPDATE api_keys SET credits = credits - ? WHERE id = ?`, args: [credits, keyId] },
      {
        sql: `INSERT INTO export_jobs
              (id, key_id, template_id, status, duration_s, format, credits_used, created_at, updated_at)
              VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?)`,
        args: [jobId, keyId, templateId || null, duration, format, credits, t, t]
      },
      {
        sql: `INSERT INTO usage_log (key_id, action, meta, ts) VALUES (?, ?, ?, ?)`,
        args: [keyId, 'export.request', JSON.stringify({ jobId, duration, format }), t]
      }
    ],
    'write'
  );

  res.json({
    jobId,
    creditsUsed: credits,
    expiresAt: t + 30 * 60 * 1000
  });
}));

router.post('/report', wrap(async (req, res) => {
  const { jobId, status, size, error } = req.body || {};
  if (!jobId || !['completed', 'failed'].includes(status)) {
    return res.status(400).json({ error: 'INVALID' });
  }

  const rs = await q(
    `SELECT * FROM export_jobs WHERE id = ? AND key_id = ?`,
    [jobId, req.apiKey.id]
  );
  const job = rs.rows[0];
  if (!job) return res.status(404).json({ error: 'NOT_FOUND' });
  if (job.status !== 'running') return res.status(409).json({ error: 'ALREADY_REPORTED' });

  const t = now();
  if (status === 'completed') {
    await q(
      `UPDATE export_jobs SET status = 'completed', size_bytes = ?, error = NULL, updated_at = ?
       WHERE id = ?`,
      [Number(size) || null, t, jobId]
    );
  } else {
    await client.batch(
      [
        {
          sql: `UPDATE export_jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`,
          args: [String(error || 'unknown').slice(0, 500), t, jobId]
        },
        {
          sql: `UPDATE api_keys SET credits = credits + ? WHERE id = ?`,
          args: [job.credits_used, req.apiKey.id]
        }
      ],
      'write'
    );
  }
  res.json({ ok: true, status });
}));

router.get('/:jobId', wrap(async (req, res) => {
  const rs = await q(
    `SELECT * FROM export_jobs WHERE id = ? AND key_id = ?`,
    [req.params.jobId, req.apiKey.id]
  );
  const job = rs.rows[0];
  if (!job) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(job);
}));

export default router;
