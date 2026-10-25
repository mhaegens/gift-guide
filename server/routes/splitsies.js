'use strict';

const express = require('express');
const db = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const { serializeItem } = require('./items');
const { parseAmount } = require('../services/splitsies');
const router = express.Router();

// Check ownership before looking up funding, so owners never learn whether it exists.
router.use('/:itemId/splitsies', requireAuth, (req, res, next) => {
  const item = db.prepare('SELECT * FROM wishlist_items WHERE id = ?').get(Number(req.params.itemId));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.owner_id === req.user.id) return res.status(403).json({ error: 'Splitsies is only available for other people’s gifts' });
  req.gift = item;
  next();
});

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function contribute(req, res, start) {
  const body = req.body || {};
  const amount = parseAmount(body.amount);
  const target = body.target == null || body.target === '' ? null : parseAmount(body.target);
  if (amount === null || (start && body.target != null && body.target !== '' && target === null)) {
    return res.status(422).json({ error: 'Enter a positive euro amount with at most two decimal places (maximum €1,000,000)' });
  }
  if (body.note != null && (typeof body.note !== 'string' || body.note.length > 300)) {
    return res.status(422).json({ error: 'Keep your sponsorship description under 300 characters' });
  }
  try {
    db.transaction(() => {
      const itemId = req.gift.id;
      if (db.prepare('SELECT 1 FROM claims WHERE item_id = ?').get(itemId)) fail(409, 'This gift has already been claimed');
      let group = db.prepare('SELECT * FROM splitsies WHERE item_id = ?').get(itemId);
      if (start) {
        if (group) fail(409, 'Someone already started splitsies. Join their group instead.');
        db.prepare('INSERT INTO splitsies (item_id, starter_id, target_cents) VALUES (?, ?, ?)').run(itemId, req.user.id, target);
        group = { target_cents: target };
      } else if (!group) {
        fail(409, 'This splitsies group has ended. Refresh to start a new one.');
      }
      const others = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM split_contributions WHERE item_id = ? AND user_id != ?').get(itemId, req.user.id).total;
      if (group.target_cents !== null && others + amount > group.target_cents) fail(409, 'Your contribution exceeds the amount left to sponsor');
      db.prepare(`
        INSERT INTO split_contributions (item_id, user_id, amount_cents, note) VALUES (?, ?, ?, ?)
        ON CONFLICT(item_id, user_id) DO UPDATE SET amount_cents = excluded.amount_cents, note = excluded.note
      `).run(itemId, req.user.id, amount, body.note?.trim() || null);
    }).immediate();
    res.status(start ? 201 : 200).json(serializeItem(req.gift, null, req.user.id));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  }
}

router.post('/:itemId/splitsies', (req, res) => contribute(req, res, true));
router.put('/:itemId/splitsies', (req, res) => contribute(req, res, false));
router.get('/:itemId/splitsies', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE item_id = ?').get(req.gift.id) || null;
  res.json(serializeItem(req.gift, claim, req.user.id));
});
router.delete('/:itemId/splitsies', (req, res) => {
  try {
    db.transaction(() => {
      const itemId = req.gift.id;
      const removed = db.prepare('DELETE FROM split_contributions WHERE item_id = ? AND user_id = ?').run(itemId, req.user.id);
      if (!removed.changes) fail(404, 'You are not part of this splitsies group');
      const next = db.prepare('SELECT user_id FROM split_contributions WHERE item_id = ? ORDER BY joined_at, user_id LIMIT 1').get(itemId);
      if (!next) db.prepare('DELETE FROM splitsies WHERE item_id = ?').run(itemId);
      else db.prepare('UPDATE splitsies SET starter_id = ? WHERE item_id = ? AND starter_id = ?').run(next.user_id, itemId, req.user.id);
    }).immediate();
    res.json(serializeItem(req.gift, null, req.user.id));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

module.exports = router;
