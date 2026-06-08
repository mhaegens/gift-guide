'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/schema');

router.get('/', (req, res) => {
  if (!process.env.STATS_API_KEY || req.query.key !== process.env.STATS_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const row = db.prepare(`
    SELECT COUNT(*) AS total, COUNT(c.id) AS claimed
    FROM wishlist_items wi
    LEFT JOIN claims c ON c.item_id = wi.id
  `).get();
  res.json({ total: row.total, claimed: row.claimed, available: row.total - row.claimed });
});

module.exports = router;
