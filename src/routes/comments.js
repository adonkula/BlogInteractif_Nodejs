// src/routes/comments.js
import { Router } from 'express';
import { getDb } from '../utils/db.js';
import { requireAdmin } from '../middleware/apiKey.js';

const router = Router();

// Helper: valider un id numérique positif
function toId(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * GET /api/articles/:id/comments
 * Liste paginée des commentaires d’un article (approved=1 par défaut).
 * Query: page, limit, approved (0|1)  → si approved=0, réservé à l’admin.
 */
router.get('/articles/:id/comments', async (req, res) => {
  const db = await getDb();
  const articleId = toId(req.params.id);
  if (!articleId) return res.status(400).json({ error: 'ID invalide' });

  // pagination
  const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
  const offset = (page - 1) * limit;

  // approved: public = 1 ; si 0 demandé, on vérifie la clé admin
  let approved = 1;
  if (req.query.approved === '0') {
    // simple check: réutilise requireAdmin en mode inline
    const fakeRes = { status: () => ({ json: () => {} }) };
    let isAdmin = true;
    await new Promise((resolve) =>
      requireAdmin(req, fakeRes, (err) => {
        isAdmin = !err;
        resolve();
      })
    );
    if (isAdmin) approved = 0; // admin peut voir les non approuvés
  }

  // vérifier que l’article existe et publié
  const art = await db.get(`SELECT id FROM articles WHERE id = ? AND published = 1`, [articleId]);
  if (!art) return res.status(404).json({ error: 'Article introuvable' });

  const rows = await db.all(
    `SELECT id, author, content, created_at, approved
       FROM comments
      WHERE article_id = ?
        AND approved = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    articleId, approved, limit, offset
  );

  const totalRow = await db.get(
    `SELECT COUNT(*) AS total
       FROM comments
      WHERE article_id = ?
        AND approved = ?`,
    articleId, approved
  );

  res.json({ page, limit, total: totalRow.total, items: rows });
});

/**
 * POST /api/articles/:id/comments
 * body: { author, content }
 * Règles:
 *  - author 2..80 chars
 *  - content 2..2000 chars
 *  - Honeypot optionnel: body.hp (doit rester vide)
 */
router.post('/articles/:id/comments', async (req, res) => {
  const db = await getDb();
  const articleId = toId(req.params.id);
  if (!articleId) return res.status(400).json({ error: 'ID invalide' });

  const author = (req.body?.author || '').trim();
  const content = (req.body?.content || '').trim();
  const honeypot = (req.body?.hp || '').trim();

  const art = await db.get(`SELECT id FROM articles WHERE id = ? AND published = 1`, [articleId]);
  if (!art) return res.status(404).json({ error: 'Article introuvable' });

  if (honeypot) return res.status(400).json({ error: 'Requête invalide' }); // anti-bot simple
  if (author.length < 2 || author.length > 80) {
    return res.status(400).json({ error: 'author doit contenir entre 2 et 80 caractères.' });
  }
  if (content.length < 2 || content.length > 2000) {
    return res.status(400).json({ error: 'content doit contenir entre 2 et 2000 caractères.' });
  }

  await db.run(
    `INSERT INTO comments(article_id, author, content, approved)
     VALUES(?, ?, ?, 1)`,
    articleId, author, content
  );

  res.status(201).json({ ok: true });
});

/**
 * PUT /api/comments/:id/approve  (admin)
 * body: { approved: 0|1 }
 */
router.put('/comments/:id/approve', requireAdmin, async (req, res) => {
  const db = await getDb();
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const approved = Number(req.body?.approved);
  if (![0, 1].includes(approved)) {
    return res.status(400).json({ error: 'approved doit être 0 ou 1.' });
  }

  const r = await db.run(`UPDATE comments SET approved = ? WHERE id = ?`, approved, id);
  if (r.changes === 0) return res.status(404).json({ error: 'Commentaire introuvable.' });

  const updated = await db.get(
    `SELECT id, article_id, author, content, created_at, approved FROM comments WHERE id = ?`,
    id
  );
  res.json(updated);
});

/**
 * DELETE /api/comments/:id  (admin)
 */
router.delete('/comments/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const r = await db.run(`DELETE FROM comments WHERE id = ?`, id);
  if (r.changes === 0) return res.status(404).json({ error: 'Commentaire introuvable.' });
  res.json({ ok: true });
});

export default router;