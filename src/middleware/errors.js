import { ZodError } from 'zod';

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'VALIDATION', details: err.flatten() });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('[500]', err);
  res.status(status).json({ error: err.code || err.message || 'INTERNAL' });
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'NOT_FOUND' });
}

export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
