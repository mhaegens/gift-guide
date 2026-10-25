'use strict';

const express = require('express');
const db = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const router = express.Router();

// Aggregate counts only: no gift, recipient, or contributor identities.
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM wishlist_items) AS gifts,
      (SELECT COUNT(*) FROM claims) AS claims,
      (SELECT COUNT(*) FROM splitsies) AS splitsies
  `).get();
  res.json({ ...counts, available: counts.gifts - counts.claims - counts.splitsies });
});

module.exports = router;
