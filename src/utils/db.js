// src/utils/db.js
import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

sqlite3.verbose();

// Résolution des chemins à partir de src/utils/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');       // racine du projet
const SQL_DIR = path.join(ROOT, 'sql');                 // dossier pour blog.db
const INIT_SQL_PATH = path.join(ROOT, 'models', 'init.sql');

// S'assurer que le dossier sql/ existe
if (!fs.existsSync(SQL_DIR)) {
  fs.mkdirSync(SQL_DIR, { recursive: true });
}

// Chemin de la base (env prioritaire)
const DB_FILE = process.env.DATABASE_FILE || path.join(SQL_DIR, 'blog.db');

/** Retourne un handle sqlite (promesse) */
export async function getDb() {
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  // PRAGMA utiles
  await db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
  `);

  return db;
}

/** Initialise le schéma si besoin */
export async function initDb() {
  if (!fs.existsSync(INIT_SQL_PATH)) {
    throw new Error(`Fichier SQL introuvable : ${INIT_SQL_PATH}`);
  }
  const initSql = fs.readFileSync(INIT_SQL_PATH, 'utf-8');
  const db = await getDb();
  await db.exec(initSql);
  await db.close();
  console.log(`Base initialisée -> ${DB_FILE}`);
}

// Permet: node src/utils/db.js --init
if (process.argv.includes('--init')) {
  initDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erreur init DB:', err);
      process.exit(1);
    });
}