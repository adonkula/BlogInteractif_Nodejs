// src/routes/tags.js
import express from 'express';
import { getDb } from '../utils/db.js';
import { slugify } from '../utils/slugify.js';
import { requireAdmin } from '../middleware/apiKey.js';

const router = express.Router();

// Helper: valider un id numérique positif
function toId(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * GET /api/tags
 * Params optionnels:
 *   - q: filtre (contient) sur name/slug
 *   - limit, page (pagination simple)
 */
router.get('/', async (req, res) => {
  const db = await getDb();

  const q = (req.query.q || '').trim();
  const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);
  const offset = (page - 1) * limit;

  const rows = await db.all(
    `
    SELECT id, name, slug
      FROM tags
     WHERE (? = '' OR name LIKE '%'||?||'%' OR slug LIKE '%'||?||'%')
     ORDER BY name ASC
     LIMIT ? OFFSET ?
    `,
    q, q, q, limit, offset
  );

  const totalRow = await db.get(
    `SELECT COUNT(*) AS total
       FROM tags
      WHERE (? = '' OR name LIKE '%'||?||'%' OR slug LIKE '%'||?||'%')`,
    q, q, q
  );

  res.json({ page, limit, total: totalRow.total, items: rows });
});

/**
 * POST /api/tags  (admin)
 * body: { name }
 */
router.post('/', requireAdmin, async (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Le champ "name" est requis.' });

  const db = await getDb();
  try {
    const slug = slugify(name);
    const r = await db.run(
      `INSERT INTO tags (name, slug) VALUES (?, ?)`,
      name, slug
    );
    const created = await db.get(
      `SELECT id, name, slug FROM tags WHERE id = ?`,
      r.lastID
    );
    res.status(201).json(created);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Ce tag existe déjà (name/slug).' });
    }
    res.status(500).json({ error: 'Erreur base de données', detail: msg });
  }
});

/**
 * PUT /api/tags/:id  (admin)
 * body: { name }
 */
router.put('/:id', requireAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Le champ "name" est requis.' });

  const db = await getDb();
  try {
    const slug = slugify(name);
    const r = await db.run(
      `UPDATE tags SET name = ?, slug = ? WHERE id = ?`,
      name, slug, id
    );
    if (r.changes === 0) return res.status(404).json({ error: 'Tag introuvable.' });

    const updated = await db.get(
      `SELECT id, name, slug FROM tags WHERE id = ?`,
      id
    );
    res.json(updated);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Ce tag existe déjà (name/slug).' });
    }
    res.status(500).json({ error: 'Erreur base de données', detail: msg });
  }
});

/**
 * DELETE /api/tags/:id  (admin)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const db = await getDb();

  // Optionnel: vérifier s’il est utilisé
  const used = await db.get(
    `SELECT COUNT(*) AS nb FROM article_tags WHERE tag_id = ?`,
    id
  );
  if (used?.nb > 0) {
    return res.status(409).json({
      error: 'Tag utilisé par des articles.',
      detail: `Retirez d’abord les liaisons (articles: ${used.nb}).`
    });
  }

  const r = await db.run(`DELETE FROM tags WHERE id = ?`, id);
  if (r.changes === 0) return res.status(404).json({ error: 'Tag introuvable.' });
  res.json({ ok: true });
});

export default router;
