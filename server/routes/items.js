'use strict';

const express = require('express');
const db = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const ogEnricher = require('../services/ogEnricher');

// userRouter is mounted at /api/users
const userRouter = express.Router();
// itemRouter is mounted at /api/items
const itemRouter = express.Router();

const VALID_PRICE_CATEGORIES = ['free', '0_20', '20_50', '50_100', '100_plus'];

function serializeItem(item, claim, requesterId) {
  const base = {
    id: item.id,
    title: item.title,
    description: item.description,
    url: item.url,
    og_image_url: item.og_image_url,
    buyer_notes: item.buyer_notes,
    price_category: item.price_category,
    created_at: item.created_at,
  };

  // Owner sees their list with zero claim information
  if (requesterId === item.owner_id) return base;

  // Everyone else sees claimed indicator + whether they are the claimer
  return {
    ...base,
    is_claimed: claim !== null,
    claimed_by_me: claim != null ? claim.claimer_id === requesterId : false,
    // claimer identity is NEVER included
  };
}

// GET /api/users/:id/items
userRouter.get('/:id/items', requireAuth, (req, res) => {
  const ownerId = parseInt(req.params.id, 10);

  const owner = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(ownerId);
  if (!owner) {
    return res.status(404).json({ error: 'User not found' });
  }

  const items = db.prepare(`
    SELECT * FROM wishlist_items WHERE owner_id = ? ORDER BY created_at DESC
  `).all(ownerId);

  const serialized = items.map(item => {
    const claim = db.prepare('SELECT * FROM claims WHERE item_id = ?').get(item.id) || null;
    return serializeItem(item, claim, req.user.id);
  });

  res.json(serialized);
});

// POST /api/users/me/items
userRouter.post('/me/items', requireAuth, (req, res) => {
  const { title, description, url, buyer_notes, price_category } = req.body || {};

  if (!title) {
    return res.status(422).json({ error: 'title is required' });
  }
  if (!price_category || !VALID_PRICE_CATEGORIES.includes(price_category)) {
    return res.status(422).json({ error: `price_category must be one of: ${VALID_PRICE_CATEGORIES.join(', ')}` });
  }

  const result = db.prepare(`
    INSERT INTO wishlist_items (owner_id, title, description, url, buyer_notes, price_category)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, description || null, url || null, buyer_notes || null, price_category);

  const item = db.prepare('SELECT * FROM wishlist_items WHERE id = ?').get(result.lastInsertRowid);

  // Fire-and-forget OG enrichment
  if (url && process.env.OG_FETCH_ENABLED === 'true') {
    const newItemId = result.lastInsertRowid;
    ogEnricher(url).then(meta => {
      if (meta.og_image_url || meta.title) {
        db.prepare(`
          UPDATE wishlist_items
          SET og_image_url = COALESCE(?, og_image_url), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(meta.og_image_url || null, newItemId);
      }
    }).catch(() => {});
  }

  res.status(201).json(serializeItem(item, null, req.user.id));
});

// PATCH /api/users/me/items/:itemId
userRouter.patch('/me/items/:itemId', requireAuth, (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);

  const item = db.prepare('SELECT * FROM wishlist_items WHERE id = ?').get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (item.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  const { title, description, url, buyer_notes, price_category } = req.body || {};
  const updates = {};

  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (url !== undefined) updates.url = url;
  if (buyer_notes !== undefined) updates.buyer_notes = buyer_notes;
  if (price_category !== undefined) {
    if (!VALID_PRICE_CATEGORIES.includes(price_category)) {
      return res.status(422).json({ error: `price_category must be one of: ${VALID_PRICE_CATEGORIES.join(', ')}` });
    }
    updates.price_category = price_category;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(422).json({ error: 'No valid fields to update' });
  }

  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE wishlist_items SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), itemId);

  const updated = db.prepare('SELECT * FROM wishlist_items WHERE id = ?').get(itemId);
  const claim = db.prepare('SELECT * FROM claims WHERE item_id = ?').get(itemId) || null;
  res.json(serializeItem(updated, claim, req.user.id));
});

// DELETE /api/users/me/items/:itemId
userRouter.delete('/me/items/:itemId', requireAuth, (req, res) => {
  const itemId = parseInt(req.params.itemId, 10);

  const item = db.prepare('SELECT * FROM wishlist_items WHERE id = ?').get(itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (item.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  db.prepare('DELETE FROM wishlist_items WHERE id = ?').run(itemId);
  res.json({ ok: true });
});

// POST /api/items/enrich
itemRouter.post('/enrich', requireAuth, async (req, res) => {
  const { url } = req.body || {};

  if (!url) {
    return res.status(422).json({ error: 'url is required' });
  }

  const meta = await ogEnricher(url);
  res.json(meta);
});

module.exports = { userRouter, itemRouter, serializeItem };
