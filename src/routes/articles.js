// src/routes/articles.js
import { Router } from 'express';
import { getDb } from '../utils/db.js';

const router = Router();

// Helper: valider un id numérique positif
function toId(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* =========================
   API – Liste d'articles
   ========================= */
router.get('/', async (req, res) => {
  const db = await getDb();

  const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);
  const offset = (page - 1) * limit;

  const params = {
    ':limit': limit,
    ':offset': offset,
    ':categoryId': req.query.categoryId ? Number(req.query.categoryId) : null,
    ':tag': req.query.tag || null,
    ':q': (req.query.q && req.query.q.trim()) ? req.query.q.trim() : null,
    ':sort': ['recent','popular'].includes(req.query.sort) ? req.query.sort : null
  };

  const sql = `
    WITH base AS (
      SELECT * FROM v_articles_public
      WHERE (:categoryId IS NULL OR EXISTS (
               SELECT 1 FROM article_categories ac
               WHERE ac.article_id = id AND ac.category_id = :categoryId))
        AND (:tag IS NULL OR EXISTS (
               SELECT 1 FROM article_tags atg
               JOIN tags t ON t.id = atg.tag_id
               WHERE atg.article_id = id AND t.slug = :tag))
        AND (:q IS NULL OR (
               title LIKE '%' || :q || '%' OR
               content LIKE '%' || :q || '%' OR
               IFNULL(tags,'') LIKE '%' || :q || '%' OR
               IFNULL(categories,'') LIKE '%' || :q || '%'
             ))
    )
    SELECT * FROM base
    ORDER BY
      CASE WHEN :sort = 'popular' THEN comments_count END DESC,
      created_at DESC
    LIMIT :limit OFFSET :offset;
  `;

  const rows = await db.all(sql, params);

  // total simple (publications)
  const totalRow = await db.get(`SELECT COUNT(*) AS total FROM v_articles_public;`);
  res.json({ page, limit, total: totalRow.total, items: rows });
});

/* =========================
   API – Détail d'un article
   ========================= */
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const article = await db.get(
    `SELECT * FROM v_article_meta WHERE id = ? AND published = 1;`,
    [id]
  );
  if (!article) return res.status(404).json({ error: 'Article introuvable' });

  const comments = await db.all(
    `SELECT id, author, content, created_at
       FROM comments
      WHERE article_id = ? AND approved = 1
      ORDER BY created_at DESC
      LIMIT 20 OFFSET 0;`,
    [id]
  );

  res.json({ article, comments });
});

/* =========================
   PAGES – Accueil & Liste
   ========================= */
router.get('/page/list', async (req, res) => {
  // Utilisé par le header: /articles?page=&q=&tag=&categoryId=
  // On réutilise l’API pour éviter de dupliquer la logique (Node 18+ a fetch global)
  try {
    const base = `http://localhost:${process.env.PORT || 3000}/api/articles?`;
    const url = base + new URLSearchParams(req.query).toString();
    const r = await fetch(url);
    const data = r.ok ? await r.json() : { items: [] };
    res.render('pages/index', {
      pageTitle: 'Articles',
      query: req.query.q || '',
      items: data.items || []
    });
  } catch {
    res.render('pages/index', { pageTitle: 'Articles', query: req.query.q || '', items: [] });
  }
});

// Accueil = liste récente
router.get('/page/home', async (_req, res) => {
  const db = await getDb();
  const rows = await db.all(`
    SELECT * FROM v_articles_public
    ORDER BY created_at DESC
    LIMIT 10 OFFSET 0;
  `);
  res.render('pages/index', { pageTitle: 'Accueil', items: rows, query: '' });
});

/* =========================
   PAGES – Détail
   ========================= */
router.get('/page/:id', async (req, res) => {
  const db = await getDb();
  const id = toId(req.params.id);
  if (!id) {
    return res
      .status(400)
      .render('pages/article', { pageTitle: 'Introuvable', article: null, comments: [] });
  }

  const article = await db.get(
    `SELECT * FROM v_article_meta WHERE id = ? AND published = 1;`,
    [id]
  );
  if (!article) {
    return res
      .status(404)
      .render('pages/article', { pageTitle: 'Introuvable', article: null, comments: [] });
  }

  const comments = await db.all(
    `SELECT id, author, content, created_at
       FROM comments
      WHERE article_id = ? AND approved = 1
      ORDER BY created_at DESC;`,
    [id]
  );

  res.render('pages/article', {
    pageTitle: article.title,
    article,
    comments
  });
});

export default router;