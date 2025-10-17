import express from 'express';
import { getDb } from '../db.js';
import { slugify } from '../utils/slugify.js';
import { requireAdmin } from '../middleware/apiKey.js';

export const router = express.Router();

router.get('/', async (_req, res) => {
  const db = await getDb();
  const rows = await db.all(`SELECT id, name, slug FROM tags ORDER BY name ASC`);
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const db = await getDb();
  try {
    const slug = slugify(name);
    const r = await db.run(`INSERT INTO tags (name, slug) VALUES (?, ?)`, name.trim(), slug);
    const created = await db.get(`SELECT id, name, slug FROM tags WHERE id = ?`, r.lastID);
    res.status(201).json(created);
  } catch (e) {
    if (String(e).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'name/slug already exists' });
    }
    res.status(500).json({ error: 'DB error', detail: String(e) });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = await getDb();
  const r = await db.run(`DELETE FROM tags WHERE id = ?`, id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
