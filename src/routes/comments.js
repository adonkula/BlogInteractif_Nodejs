import express from 'express';
import { getDb } from '../db.js';
import { requireAdmin } from '../middleware/apiKey.js';

export const router = express.Router();

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = await getDb();
  const r = await db.run(`DELETE FROM comments WHERE id = ?`, id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
