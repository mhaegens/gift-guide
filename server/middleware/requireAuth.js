'use strict';

const db = require('../db/schema');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Please log in' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Please log in' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  req.user = user;
  next();
}

module.exports = requireAuth;
