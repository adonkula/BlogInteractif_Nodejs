// src/utils/server.js
import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from './db.js';
// routes (depuis src/utils -> src/routes)
import articlesRouter from '../routes/articles.js';
import categoriesRouter from '../routes/categories.js';
import tagsRouter from '../routes/tags.js';
import commentsRouter from '../routes/comments.js';

// optionnel: middleware clé API
// import apiKey from '../middleware/apiKey.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..'); // racine du projet

const app = express();

// --- Express config ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Static (public/)
app.use(express.static(path.join(ROOT, 'public')));

// Vues (views/)
app.set('views', path.join(ROOT, 'views'));
app.set('view engine', 'ejs');

// Locals (accessibles dans tous les .ejs)
app.locals.authorName = 'Adolph Nkula';
app.locals.studentId = '123456789';
app.locals.collegeName = 'La Cité';

// --- Démo front minimal (si tu as des pages EJS) ---
app.get('/', (_req, res) => {
  res.render('pages/index', { pageTitle: 'Accueil' });
});

// --- API ---
app.use('/api/articles', articlesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/comments', commentsRouter);

// Exemple: protéger certaines routes admin
// app.use('/api/articles', apiKey, articlesRouterAdmin);

// Health
app.get('/api/health', async (_req, res) => {
  try {
    const db = await getDb();
    await db.get('SELECT 1 AS ok');
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch (e) {
    res.status(500).json({ status: 'down', error: String(e) });
  }
});

// 404 JSON pour /api/*
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 404 pages pour front (facultatif)
app.use((req, res) => {
  res.status(404).render('pages/index', { pageTitle: '404' });
});

// Boot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
