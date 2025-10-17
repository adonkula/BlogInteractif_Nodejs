-- =========================================================
-- Schéma SQLite pour "Blog Interactif"
-- Compatible avec les routes: articles, comments, tags, categories
-- =========================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================
-- Tables
-- ============================

CREATE TABLE IF NOT EXISTS articles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  content     TEXT DEFAULT '',
  published   INTEGER DEFAULT 0,             -- 0 brouillon / 1 publié
  views       INTEGER  DEFAULT 0,
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT UNIQUE NOT NULL,
  slug  TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS article_categories (
  article_id  INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (article_id, category_id),
  FOREIGN KEY (article_id)  REFERENCES articles(id)   ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT UNIQUE NOT NULL,
  slug  TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id  INTEGER NOT NULL,
  tag_id      INTEGER NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)     REFERENCES tags(id)     ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  INTEGER NOT NULL,
  author      TEXT,
  content     TEXT NOT NULL,
  approved    INTEGER DEFAULT 1,                     -- 1 = affiché publiquement
  created_at  TEXT    DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- ============================
-- Index (perfs)
-- ============================

CREATE INDEX IF NOT EXISTS idx_articles_slug       ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);
CREATE INDEX IF NOT EXISTS idx_categories_slug     ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_tags_slug           ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_comments_article    ON comments(article_id, approved, created_at);

-- ============================
-- Données de démo (idempotent)
-- ============================

-- Catégorie + Tag
INSERT INTO categories (name, slug)
VALUES ('Général', 'general')
ON CONFLICT DO NOTHING;

INSERT INTO tags (name, slug)
VALUES ('demo', 'demo')
ON CONFLICT DO NOTHING;

-- Article publié de bienvenue
INSERT INTO articles (title, slug, content, published, views, created_at, updated_at)
VALUES (
  'Bienvenue sur le blog',
  'bienvenue-sur-le-blog',
  'Ceci est votre premier article 🎉\n\nVous pouvez le modifier ou en créer d''autres depuis l''interface admin.',
  1,
  3,
  datetime('now'),
  datetime('now')
)
ON CONFLICT DO NOTHING;

-- Liaison article ↔ catégorie
INSERT OR IGNORE INTO article_categories (article_id, category_id)
SELECT a.id, c.id
FROM articles a, categories c
WHERE a.slug='bienvenue-sur-le-blog' AND c.slug='general';

-- Liaison article ↔ tag
INSERT OR IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, t.id
FROM articles a, tags t
WHERE a.slug='bienvenue-sur-le-blog' AND t.slug='demo';

-- Commentaire approuvé
INSERT INTO comments (article_id, author, content, approved, created_at)
SELECT a.id, 'Admin', 'Bravo pour le lancement !', 1, datetime('now')
FROM articles a WHERE a.slug='bienvenue-sur-le-blog';

-- ============================
-- Vues utilisées par les routes
-- ============================

-- Vue méta: article + catégories (concat) + tags (concat) + nb commentaires approuvés
DROP VIEW IF EXISTS v_article_meta;
CREATE VIEW IF NOT EXISTS v_article_meta AS
SELECT
  a.id,
  a.title,
  a.slug,
  a.content,
  a.published,
  a.views,
  a.created_at,
  a.updated_at,
  (
    SELECT GROUP_CONCAT(c.name, ', ')
    FROM article_categories ac
    JOIN categories c ON c.id = ac.category_id
    WHERE ac.article_id = a.id
  ) AS categories,
  (
    SELECT GROUP_CONCAT(t.name, ', ')
    FROM article_tags atg
    JOIN tags t ON t.id = atg.tag_id
    WHERE atg.article_id = a.id
  ) AS tags,
  (
    SELECT COUNT(*)
    FROM comments cm
    WHERE cm.article_id = a.id AND cm.approved = 1
  ) AS comments_count
FROM articles a;

-- Vue publique: uniquement les articles publiés
DROP VIEW IF EXISTS v_articles_public;
CREATE VIEW IF NOT EXISTS v_articles_public AS
SELECT *
FROM v_article_meta
WHERE published = 1;