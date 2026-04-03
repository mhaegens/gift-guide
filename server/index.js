'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

// Initialize DB schema (creates tables if they don't exist)
require('./db/schema');

const SQLiteStore = require('connect-sqlite3')(session);

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const { userRouter: itemsUserRouter, itemRouter: itemsItemRouter } = require('./routes/items');
const { claimsOnItemRouter, claimsMineRouter } = require('./routes/claims');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DB_DIR = path.dirname(path.resolve(process.env.DB_PATH || './data/gift-guide.db'));

app.use(express.json());
app.set('trust proxy', 1);

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: DB_DIR }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: parseInt(process.env.SESSION_TTL_DAYS || '30', 10) * 24 * 60 * 60 * 1000,
  },
}));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/users', itemsUserRouter);   // GET /api/users/:id/items, POST/PATCH/DELETE /api/users/me/items
app.use('/api/items', itemsItemRouter);   // POST /api/items/enrich
app.use('/api/items', claimsOnItemRouter); // POST/DELETE /api/items/:itemId/claim
app.use('/api/claims', claimsMineRouter);  // GET /api/claims/mine

// Serve Phase 3 Vue frontend from /public (when built)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(PORT, () => {
  console.log(`Gift Guide server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
