'use strict';

const db = require('../db/schema');

function getSplitsies(itemId, requesterId) {
  const group = db.prepare(`
    SELECT s.*, u.display_name AS starter_name FROM splitsies s
    JOIN users u ON u.id = s.starter_id WHERE s.item_id = ?
  `).get(itemId);
  if (!group) return null;
  const participants = db.prepare(`
    SELECT c.user_id, u.display_name, c.amount_cents, c.note FROM split_contributions c
    JOIN users u ON u.id = c.user_id WHERE c.item_id = ? ORDER BY c.joined_at, c.user_id
  `).all(itemId).map(p => ({ ...p, is_me: p.user_id === requesterId }));
  const total = participants.reduce((sum, p) => sum + p.amount_cents, 0);
  return {
    starter_id: group.starter_id,
    starter_name: group.starter_name,
    target_cents: group.target_cents,
    total_cents: total,
    remaining_cents: group.target_cents === null ? null : Math.max(0, group.target_cents - total),
    participants,
  };
}

// Accept decimal euros, storing integer cents to avoid rounding and oversubscription.
function parseAmount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) return null;
  const [euros, cents = ''] = raw.split('.');
  const amount = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
  return amount > 0 && amount <= 100000000 ? amount : null;
}

module.exports = { getSplitsies, parseAmount };
