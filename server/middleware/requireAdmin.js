'use strict';

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  next();
}

module.exports = requireAdmin;
