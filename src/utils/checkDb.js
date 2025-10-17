// src/utils/checkDb.js
import { getDb } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const DB_FILE = path.join(ROOT, 'sql', 'blog.db');

async function checkDatabase() {
  console.log('🔍 Vérification de la base de données SQLite...');
  console.log(`Chemin : ${DB_FILE}\n`);

  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ Fichier blog.db introuvable ! Exécute : npm run db:init');
    process.exit(1);
  }

  const db = await getDb();
  const tables = await db.all(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`
  );

  console.log('📋 Tables détectées :');
  tables.forEach(t => console.log(' -', t.name));

  const expected = [
    'articles',
    'categories',
    'article_categories',
    'tags',
    'article_tags',
    'comments'
  ];
  const missing = expected.filter(n => !tables.some(t => t.name === n));

  if (missing.length) console.warn('\n⚠️ Tables manquantes :', missing.join(', '));
  else console.log('\n✅ Toutes les tables principales sont présentes !');

  const { nb } = await db.get('SELECT COUNT(*) AS nb FROM articles;');
  console.log(`📰 Articles présents : ${nb}`);

  console.log('\n📚 Aperçu des trois premiers articles :\n');
  const rows = await db.all(`
    SELECT a.id, a.title,
           (SELECT GROUP_CONCAT(DISTINCT c.name) 
              FROM article_categories ac JOIN categories c ON c.id=ac.category_id 
             WHERE ac.article_id=a.id) AS categories,
           (SELECT GROUP_CONCAT(DISTINCT t.name) 
              FROM article_tags atg JOIN tags t ON t.id=atg.tag_id 
             WHERE atg.article_id=a.id) AS tags
    FROM articles a
    ORDER BY a.created_at DESC
    LIMIT 3;
  `);

  rows.forEach(r => {
    console.log(`🆔 ${r.id} — ${r.title}`);
    console.log(`   🏷️  Catégories : ${r.categories || '(aucune)'}`);
    console.log(`   🔖 Tags : ${r.tags || '(aucun)'}\n`);
  });

  await db.close();
  console.log('🟢 Vérification terminée avec succès.\n');
}

checkDatabase();