'use strict';

const express = require('express');
const db = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const { serializeItem } = require('./items');

// claimsOnItemRouter is mounted at /api/items
const claimsOnItemRouter = express.Router();
// claimsMineRouter is mounted at /api/claims
const claimsMineRouter = express.Router();

// POST /api/items/:itemId/claim
claimsOnItemRouter.post('/:itemId/claim', requireAuth, (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);

  const item = db.prepare('SELECT * FROM wishlist_items WHERE id = ?').get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (item.owner_id === req.user.id) {
    return res.status(403).json({ error: 'You cannot claim your own items' });
  }
  try {
    const claimed = db.transaction(() => {
      if (db.prepare('SELECT 1 FROM splitsies WHERE item_id = ?').get(itemId)) return false;
      db.prepare('INSERT INTO claims (item_id, claimer_id) VALUES (?, ?)').run(itemId, req.user.id);
      return true;
    }).immediate();
    if (!claimed) return res.status(409).json({ error: 'People are going splitsies on this gift. Join their group instead.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE'))) {
      return res.status(409).json({ error: 'This item was just claimed by someone else' });
    }
    throw err;
  }

  res.status(201).json({ ok: true });
});

// DELETE /api/items/:itemId/claim
claimsOnItemRouter.delete('/:itemId/claim', requireAuth, (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);

  const claim = db.prepare('SELECT * FROM claims WHERE item_id = ?').get(itemId);
  if (!claim) {
    return res.status(404).json({ error: 'No claim found for this item' });
  }
  if (claim.claimer_id !== req.user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  db.prepare('DELETE FROM claims WHERE item_id = ?').run(itemId);
  res.json({ ok: true });
});

// GET /api/claims/mine
claimsMineRouter.get('/mine', requireAuth, (req, res) => {
  const claims = db.prepare(`
    SELECT wi.*, c.claimer_id, COALESCE(c.claimed_at, sc.joined_at) AS claimed_at
    FROM wishlist_items wi
    LEFT JOIN claims c ON wi.id = c.item_id
    LEFT JOIN split_contributions sc ON wi.id = sc.item_id AND sc.user_id = ?
    WHERE wi.owner_id != ? AND (c.claimer_id = ? OR sc.user_id = ?)
    ORDER BY claimed_at DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id);

  const grouped = {};
  for (const row of claims) {
    const claim = row.claimer_id == null ? null : { claimer_id: row.claimer_id, claimed_at: row.claimed_at };
    const serialized = serializeItem(row, claim, req.user.id);

    if (!grouped[row.owner_id]) {
      const owner = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(row.owner_id);
      grouped[row.owner_id] = { owner, items: [] };
    }
    grouped[row.owner_id].items.push(serialized);
  }

  res.json(Object.values(grouped));
});

module.exports = { claimsOnItemRouter, claimsMineRouter };
