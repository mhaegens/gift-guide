'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(422).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  req.session.userId = user.id;
  db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  res.json({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    is_admin: Boolean(user.is_admin),
    force_password_change: Boolean(user.force_password_change),
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    is_admin: Boolean(u.is_admin),
    force_password_change: Boolean(u.force_password_change),
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};

  if (!current_password || !new_password) {
    return res.status(422).json({ error: 'current_password and new_password are required' });
  }

  if (new_password.length < 8) {
    return res.status(422).json({ error: 'New password must be at least 8 characters' });
  }

  if (!bcrypt.compareSync(current_password, req.user.password_hash)) {
    return res.status(403).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare(`
    UPDATE users
    SET password_hash = ?, force_password_change = 0
    WHERE id = ?
  `).run(hash, req.user.id);

  res.json({ ok: true });
});

module.exports = router;
