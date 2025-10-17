import express from 'express';
import { getDb } from '../db.js';
import { slugify } from '../utils/slugify.js';
import { requireAdmin } from '../middleware/apiKey.js';

export const router = express.Router();

/**
 * GET /api/articles
 * Query: page=1&limit=10&sort=recent|popular&categoryId=1&tag=dev&q=keyword
 */
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);
  const offset = (page - 1) * limit;
  const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;
  const tagSlug = req.query.tag || null;
  const q = req.query.q?.trim() || '';
  const sort = req.query.sort === 'popular' ? 'popular' : 'recent';

  const db = await getDb();

  const where = ['a.published = 1'];
  const params = [];

  if (categoryId) {
    where.push('EXISTS (SELECT 1 FROM article_categories ac WHERE ac.article_id = a.id AND ac.category_id = ?)');
    params.push(categoryId);
  }
  if (tagSlug) {
    where.push('EXISTS (SELECT 1 FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE at.article_id = a.id AND t.slug = ?)');
    params.push(tagSlug);
  }
  if (q) {
    where.push('(a.title LIKE ? OR a.content LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const orderBy = sort === 'popular' ? 'a.views DESC, a.created_at DESC' : 'a.created_at DESC';

  const rows = await db.all(
    `SELECT a.id, a.title, a.slug, a.created_at, a.updated_at
           , (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) AS comments_count
     FROM articles a
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    ...params, limit, offset
  );

  const totalRow = await db.get(`SELECT COUNT(*) as cnt FROM articles a WHERE ${where.join(' AND ')}`, ...params);
  const total = totalRow?.cnt || 0;

  res.json({
    page, limit, total, items: rows
  });
});

/** GET /api/articles/:id */
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = await getDb();
  const article = await db.get(
    `SELECT id, title, slug, content, published, created_at, updated_at, views
     FROM articles WHERE id = ?`, id
  );
  if (!article || (!article.published && req.get('x-api-key') !== process.env.ADMIN_API_KEY)) {
    return res.status(404).json({ error: 'Article not found' });
  }
  const cats = await db.all(
    `SELECT c.id, c.name, c.slug
       FROM categories c
       JOIN article_categories ac ON ac.category_id = c.id
      WHERE ac.article_id = ?`, id
  );
  const tags = await db.all(
    `SELECT t.id, t.name, t.slug
       FROM tags t
       JOIN article_tags at ON at.tag_id = t.id
      WHERE at.article_id = ?`, id
  );
  const comments = await db.all(
    `SELECT id, author, content, created_at
       FROM comments WHERE article_id = ? AND approved = 1
       ORDER BY created_at DESC LIMIT 25`, id
  );
  // Incrémenter la vue de façon best-effort
  db.run(`UPDATE articles SET views = COALESCE(views,0)+1 WHERE id = ?`, id).catch(()=>{});
  res.json({ ...article, categories: cats, tags, comments });
});

/** POST /api/articles (admin) */
router.post('/', requireAdmin, async (req, res) => {
  const { title, content = '', published = 0, categories = [], tags = [] } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const db = await getDb();
  const slug = slugify(title);
  const now = new Date().toISOString();

  try {
    const result = await db.run(
      `INSERT INTO articles (title, slug, content, published, created_at, updated_at, views)
       VALUES (?, ?, ?, ?, ?, ?, 0)`, title.trim(), slug, content, published ? 1 : 0, now, now
    );
    const articleId = result.lastID;

    // Liaisons catégories
    for (const cid of categories || []) {
      await db.run(`INSERT OR IGNORE INTO article_categories (article_id, category_id) VALUES (?, ?)`, articleId, cid);
    }
    // Liaisons tags (crée si tag inexistant)
    for (const t of tags || []) {
      const tSlug = slugify(t);
      let tagRow = await db.get(`SELECT id FROM tags WHERE slug = ?`, tSlug);
      if (!tagRow) {
        const ins = await db.run(`INSERT INTO tags (name, slug) VALUES (?, ?)`, t, tSlug);
        tagRow = { id: ins.lastID };
      }
      await db.run(`INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`, articleId, tagRow.id);
    }

    const created = await db.get(`SELECT id, title, slug, created_at FROM articles WHERE id = ?`, articleId);
    res.status(201).json(created);
  } catch (e) {
    if (String(e).includes('UNIQUE constraint failed: articles.slug')) {
      return res.status(409).json({ error: 'slug already exists' });
    }
    return res.status(500).json({ error: 'DB error', detail: String(e) });
  }
});

/** PUT /api/articles/:id (admin) */
router.put('/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, content, published, categories, tags } = req.body || {};
  const db = await getDb();
  const existing = await db.get(`SELECT * FROM articles WHERE id = ?`, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  const newTitle = title?.trim() || existing.title;
  const newSlug = newTitle !== existing.title ? slugify(newTitle) : existing.slug;
  try {
    await db.run(
      `UPDATE articles
          SET title = ?, slug = ?, content = ?, published = ?, updated_at = ?
        WHERE id = ?`,
      newTitle,
      newSlug,
      typeof content === 'string' ? content : existing.content,
      typeof published === 'number' ? (published ? 1 : 0) : existing.published,
      now,
      id
    );

    if (Array.isArray(categories)) {
      await db.run(`DELETE FROM article_categories WHERE article_id = ?`, id);
      for (const cid of categories) {
        await db.run(`INSERT OR IGNORE INTO article_categories (article_id, category_id) VALUES (?, ?)`, id, cid);
      }
    }
    if (Array.isArray(tags)) {
      await db.run(`DELETE FROM article_tags WHERE article_id = ?`, id);
      for (const t of tags) {
        const tSlug = slugify(t);
        let tagRow = await db.get(`SELECT id FROM tags WHERE slug = ?`, tSlug);
        if (!tagRow) {
          const ins = await db.run(`INSERT INTO tags (name, slug) VALUES (?, ?)`, t, tSlug);
          tagRow = { id: ins.lastID };
        }
        await db.run(`INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`, id, tagRow.id);
      }
    }

    const updated = await db.get(`SELECT id, title, slug, updated_at FROM articles WHERE id = ?`, id);
    res.json(updated);
  } catch (e) {
    if (String(e).includes('UNIQUE constraint failed: articles.slug')) {
      return res.status(409).json({ error: 'slug already exists' });
    }
    return res.status(500).json({ error: 'DB error', detail: String(e) });
  }
});

/** DELETE /api/articles/:id (admin) */
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = await getDb();
  const result = await db.run(`DELETE FROM articles WHERE id = ?`, id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

/** GET /api/articles/:id/comments */
router.get('/:id/comments', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
  const offset = (page - 1) * limit;

  const db = await getDb();
  const items = await db.all(
    `SELECT id, author, content, created_at
       FROM comments
      WHERE article_id = ? AND approved = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    id, limit, offset
  );
  const totalRow = await db.get(
    `SELECT COUNT(*) as cnt FROM comments WHERE article_id = ? AND approved = 1`, id
  );
  res.json({ page, limit, total: totalRow?.cnt || 0, items });
});

/** POST /api/articles/:id/comments */
router.post('/:id/comments', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { author = 'Anonyme', content = '' } = req.body || {};
  if (!content.trim()) return res.status(400).json({ error: 'content is required' });

  const db = await getDb();
  const article = await db.get(`SELECT id, published FROM articles WHERE id = ?`, id);
  if (!article || !article.published) return res.status(404).json({ error: 'Article not found' });

  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO comments (article_id, author, content, approved, created_at)
     VALUES (?, ?, ?, 1, ?)`,
    id, author || 'Anonyme', content.trim(), now
  );
  const created = await db.get(`SELECT id, author, content, created_at FROM comments WHERE id = ?`, result.lastID);
  res.status(201).json(created);
});

export default router;
