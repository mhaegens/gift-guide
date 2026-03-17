'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// GET /api/users — list all active users (id + display_name only)
router.get('/', requireAuth, (req, res) => {
  const users = db.prepare(`
    SELECT id, display_name FROM users WHERE is_active = 1 ORDER BY display_name ASC
  `).all();
  res.json(users);
});

// POST /api/users — create user (admin only)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { username, display_name, password, is_admin = false } = req.body || {};

  if (!username || !display_name || !password) {
    return res.status(422).json({ error: 'username, display_name and password are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(422).json({ error: 'Username already taken' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(`
    INSERT INTO users (username, display_name, password_hash, is_admin, force_password_change)
    VALUES (?, ?, ?, ?, 1)
  `).run(username, display_name, hash, is_admin ? 1 : 0);

  const user = db.prepare('SELECT id, username, display_name, is_admin, is_active, force_password_change FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PATCH /api/users/:id — update user (admin or self)
router.patch('/:id', requireAuth, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const isSelf = req.user.id === targetId;
  const isAdmin = Boolean(req.user.is_admin);

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { display_name, is_admin, is_active } = req.body || {};
  const updates = {};

  if (display_name !== undefined) updates.display_name = display_name;

  if (isAdmin) {
    if (is_admin !== undefined) updates.is_admin = is_admin ? 1 : 0;
    if (is_active !== undefined) {
      if (!is_active && isSelf) {
        return res.status(403).json({ error: 'You cannot deactivate your own account' });
      }
      updates.is_active = is_active ? 1 : 0;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(422).json({ error: 'No valid fields to update' });
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), targetId);

  const updated = db.prepare('SELECT id, username, display_name, is_admin, is_active, force_password_change FROM users WHERE id = ?').get(targetId);
  res.json(updated);
});

// POST /api/users/:id/reset-password — admin resets another user's password
router.post('/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { password } = req.body || {};

  if (!password) {
    return res.status(422).json({ error: 'password is required' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare(`
    UPDATE users SET password_hash = ?, force_password_change = 1 WHERE id = ?
  `).run(hash, targetId);

  res.json({ ok: true });
});

module.exports = router;
