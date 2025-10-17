// src/utils/server.js
import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';


import { getDb } from './db.js';

// ROUTES
import articlesRouter from '../routes/articles.js';
import categoriesRouter from '../routes/categories.js';
import tagsRouter from '../routes/tags.js';
import commentsRouter from '../routes/comments.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..'); // racine du projet

const app = express();

/* -----------------------
   Middlewares globaux
----------------------- */
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true })); // <— utile si tu postes des forms classiques
app.use(morgan('dev'));

/* -----------------------
   Statics & Vues
----------------------- */
app.use(express.static(path.join(ROOT, 'public')));
app.set('views', path.join(ROOT, 'views'));
app.set('view engine', 'ejs');

// Layouts EJS
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // utilise views/layouts/main.ejs par défaut

/* -----------------------
   Locals EJS
----------------------- */
app.locals.authorName = 'Adolph Nkula';
app.locals.studentId = '123456789';
app.locals.collegeName = 'La Cité';

/* -----------------------
   PAGES (front EJS)
----------------------- */
// Accueil -> délègue à la route “page home” d’articlesRouter
app.get('/', (req, res, next) => {
  req.url = '/page/home';
  return articlesRouter(req, res, next);
});

// Shim pour que <form action="/articles" ...> affiche la liste côté page
app.get('/articles', (req, res, next) => {
  // On réutilise la page “list” du router
  // Conserve q, page, limit, etc.
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  req.url = '/page/list' + qs;
  return articlesRouter(req, res, next);
});

// Toutes les autres pages d’articles (ex: /articles/page/:id, /articles/page/list)
app.use('/articles', articlesRouter);

/* -----------------------
   API (JSON)
----------------------- */
app.use('/api/articles', articlesRouter);     // /api/articles, /api/articles/:id
app.use('/api/categories', categoriesRouter); // /api/categories
app.use('/api/tags', tagsRouter);             // /api/tags
app.use('/api', commentsRouter);              // /api/articles/:id/comments, /api/comments/:id

// Santé
app.get('/api/health', async (_req, res) => {
  try {
    const db = await getDb();
    await db.get('SELECT 1 AS ok');
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch (e) {
    res.status(500).json({ status: 'down', error: String(e) });
  }
});

/* -----------------------
   404
----------------------- */
// 404 JSON pour /api/*
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 404 pages (front)
app.use((_req, res) => {
  res.status(404).render('pages/index', { pageTitle: '404', items: [], query: '' });
});

/* -----------------------
   Boot
----------------------- */
// Boot robuste (force IPv4 + logs d’erreur)
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server listening on http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Listen error:', err.code || err.message, err);
});

process.on('unhandledRejection', (r) => {
  console.error('❌ UnhandledRejection:', r);
});
process.on('uncaughtException', (e) => {
  console.error('❌ UncaughtException:', e);
});