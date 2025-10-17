-- Schéma SQLite pour Blog Interactif
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT DEFAULT '',
  published INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS article_categories (
  article_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (article_id, category_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  author TEXT,
  content TEXT NOT NULL,
  approved INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- Données de démo
INSERT INTO categories (name, slug) VALUES ('Général', 'general') ON CONFLICT DO NOTHING;
INSERT INTO tags (name, slug) VALUES ('demo', 'demo') ON CONFLICT DO NOTHING;

INSERT INTO articles (title, slug, content, published, views, created_at, updated_at)
VALUES ('Bienvenue sur le blog', 'bienvenue-sur-le-blog', 'Ceci est votre premier article 🎉', 1, 3, datetime('now'), datetime('now'))
ON CONFLICT DO NOTHING;

INSERT OR IGNORE INTO article_categories (article_id, category_id)
SELECT a.id, c.id FROM articles a, categories c WHERE a.slug='bienvenue-sur-le-blog' AND c.slug='general';

INSERT OR IGNORE INTO article_tags (article_id, tag_id)
SELECT a.id, t.id FROM articles a, tags t WHERE a.slug='bienvenue-sur-le-blog' AND t.slug='demo';

INSERT INTO comments (article_id, author, content, approved, created_at)
SELECT a.id, 'Admin', 'Bravo pour le lancement !', 1, datetime('now')
FROM articles a WHERE a.slug='bienvenue-sur-le-blog';