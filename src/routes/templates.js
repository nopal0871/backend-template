import { Router } from 'express';
import { nanoid } from 'nanoid';
import { q, now } from '../db.js';
import { requireKey } from '../middleware/requireKey.js';
import { TemplateBody } from '../schemas.js';
import { wrap } from '../middleware/errors.js';

const router = Router();
router.use(requireKey);

router.get('/', wrap(async (req, res) => {
  const rs = await q(
    `SELECT id, name, config, created_at, updated_at
     FROM templates WHERE key_id = ? ORDER BY updated_at DESC`,
    [req.apiKey.id]
  );
  res.json(rs.rows.map(r => ({ ...r, config: JSON.parse(r.config) })));
}));

router.get('/:id', wrap(async (req, res) => {
  const rs = await q(
    `SELECT * FROM templates WHERE id = ? AND key_id = ?`,
    [req.params.id, req.apiKey.id]
  );
  const row = rs.rows[0];
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ...row, config: JSON.parse(row.config) });
}));

router.post('/', wrap(async (req, res) => {
  const { name, config } = TemplateBody.parse(req.body);
  const id = 'tpl_' + nanoid(12);
  const t = now();
  await q(
    `INSERT INTO templates (id, key_id, name, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, req.apiKey.id, name, JSON.stringify(config), t, t]
  );
  res.status(201).json({ id, name, config, created_at: t, updated_at: t });
}));

router.put('/:id', wrap(async (req, res) => {
  const { name, config } = TemplateBody.parse(req.body);
  const t = now();
  const rs = await q(
    `UPDATE templates SET name = ?, config = ?, updated_at = ?
     WHERE id = ? AND key_id = ?`,
    [name, JSON.stringify(config), t, req.params.id, req.apiKey.id]
  );
  if (rs.rowsAffected === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ id: req.params.id, name, config, updated_at: t });
}));

router.delete('/:id', wrap(async (req, res) => {
  const rs = await q(
    `DELETE FROM templates WHERE id = ? AND key_id = ?`,
    [req.params.id, req.apiKey.id]
  );
  if (rs.rowsAffected === 0) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true });
}));

export default router;
