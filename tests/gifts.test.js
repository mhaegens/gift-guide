'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const express = require('express');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gift-guide-test-'));
process.env.DB_PATH = path.join(folder, 'gifts.db');
// A database from before priorities and splitsies existed.
const legacy = new Database(process.env.DB_PATH);
legacy.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, display_name TEXT, is_active INTEGER DEFAULT 1, is_admin INTEGER DEFAULT 0);
  INSERT INTO users (id, display_name) VALUES (1, 'Recipient'), (2, 'Michiel'), (3, 'Alice'), (4, 'Bob');
  CREATE TABLE wishlist_items (
    id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT, description TEXT, url TEXT, og_image_url TEXT, buyer_notes TEXT,
    price_category TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT
  );
  INSERT INTO wishlist_items (id, owner_id, title, price_category) VALUES (1, 1, 'Existing gift', '100_plus');
  CREATE TABLE claims (
    id INTEGER PRIMARY KEY, item_id INTEGER UNIQUE REFERENCES wishlist_items(id) ON DELETE CASCADE,
    claimer_id INTEGER REFERENCES users(id) ON DELETE CASCADE, claimed_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO claims (item_id, claimer_id) VALUES (1, 2);
`);
legacy.close();
const db = require('../server/db/schema');
const { userRouter, itemRouter } = require('../server/routes/items');
const { claimsOnItemRouter, claimsMineRouter } = require('../server/routes/claims');
const splitsiesRouter = require('../server/routes/splitsies');
const adminRouter = require('../server/routes/admin');
const app = express();
app.use(express.json());
// Test harness authenticates users while exercising the real authorization middleware.
app.use((req, res, next) => { req.session = { userId: Number(req.headers['x-test-user']) || null }; next(); });
app.use('/api/users', userRouter);
app.use('/api/items', itemRouter, claimsOnItemRouter, splitsiesRouter);
app.use('/api/claims', claimsMineRouter);
app.use('/api/admin', adminRouter);
let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(folder, { recursive: true, force: true });
});
async function call(user, method, url, body) {
  const response = await fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', 'x-test-user': String(user) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
async function create(priority = 0) {
  const result = await call(1, 'POST', '/api/users/me/items', { title: 'New gift', price_category: '100_plus', priority });
  assert.equal(result.status, 201);
  return result.body;
}
function assertPrivate(item) {
  for (const key of ['splitsies', 'is_claimed', 'claimed_by_me', 'participants', 'starter_id', 'total_cents']) {
    assert.equal(Object.hasOwn(item, key), false, `recipient response contains ${key}`);
  }
}

test('additive migration preserves existing wishes and claims and can run twice', () => {
  assert.equal(db.prepare('SELECT priority FROM wishlist_items WHERE id = 1').get().priority, 0);
  assert.equal(db.prepare('SELECT claimer_id FROM claims WHERE item_id = 1').get().claimer_id, 2);
  delete require.cache[require.resolve('../server/db/schema')];
  const again = require('../server/db/schema');
  assert.equal(again.prepare('SELECT COUNT(*) AS n FROM claims').get().n, 1);
  again.close();
});

test('owners set priorities and all wishlists sort by priority', async () => {
  const normal = await create();
  const top = await create(2);
  const high = await create(1);
  const list = await call(2, 'GET', '/api/users/1/items');
  assert.deepEqual(list.body.slice(0, 3).map(item => item.id), [top.id, high.id, normal.id]);
  assert.equal((await call(2, 'PATCH', `/api/users/me/items/${top.id}`, { priority: 0 })).status, 403);
  for (const priority of [-1, 3, '2', null, 1.5]) {
    assert.equal((await call(1, 'PATCH', `/api/users/me/items/${top.id}`, { priority })).status, 422);
  }
  const updated = await call(1, 'PATCH', `/api/users/me/items/${normal.id}`, { priority: 2 });
  assert.equal(updated.status, 200);
  assertPrivate(updated.body);
});

test('splitsies shares contributors with buyers and hides all funding from recipient', async () => {
  const item = await create();
  const endpoint = `/api/items/${item.id}/splitsies`;
  const before = (await call(1, 'GET', '/api/users/1/items')).body.find(i => i.id === item.id);
  assert.equal((await call(0, 'POST', endpoint, { amount: '30' })).status, 401);
  const started = await call(2, 'POST', endpoint, { amount: '30.25', target: '100', note: 'The controller' });
  assert.equal(started.status, 201);
  assert.equal(started.body.splitsies.total_cents, 3025);
  assert.equal(started.body.splitsies.starter_name, 'Michiel');
  assert.equal((await call(3, 'POST', endpoint, { amount: '20' })).status, 409);
  const joined = await call(3, 'PUT', endpoint, { amount: '25', note: 'Part of the gift' });
  assert.equal(joined.status, 200);
  assert.deepEqual(joined.body.splitsies.participants.map(p => p.display_name), ['Michiel', 'Alice']);
  assert.equal(joined.body.splitsies.participants[1].is_me, true);
  const observer = await call(4, 'GET', endpoint);
  assert.equal(observer.body.splitsies.participants[0].note, 'The controller');
  assert.equal(observer.body.splitsies.participants.every(p => !p.is_me), true);
  assert.equal((await call(4, 'POST', `/api/items/${item.id}/claim`)).status, 409);
  const recipient = (await call(1, 'GET', '/api/users/1/items')).body.find(i => i.id === item.id);
  assertPrivate(recipient);
  assert.deepEqual(recipient, before);
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    assert.equal((await call(1, method, endpoint, ['POST', 'PUT'].includes(method) ? { amount: '10' } : undefined)).status, 403);
  }
  const edited = await call(1, 'PATCH', `/api/users/me/items/${item.id}`, { title: 'Renamed gift' });
  assertPrivate(edited.body);
  assert.equal((await call(1, 'GET', '/api/claims/mine')).body.length, 0);
  const purchases = await call(3, 'GET', '/api/claims/mine');
  assert.equal(purchases.body[0].items.some(i => i.id === item.id && i.splitsies.participants[1].is_me), true);
  assert.equal((await call(2, 'PUT', endpoint, { amount: '40' })).body.splitsies.total_cents, 6500);
  const transferred = await call(2, 'DELETE', endpoint);
  assert.equal(transferred.body.splitsies.starter_name, 'Alice');
  assert.equal(transferred.body.splitsies.total_cents, 2500);
  assert.equal((await call(3, 'DELETE', endpoint)).body.splitsies, null);
  assert.equal((await call(4, 'POST', `/api/items/${item.id}/claim`)).status, 201);
  assert.equal((await call(2, 'POST', endpoint, { amount: '10' })).status, 409);
});

test('concurrent pledges cannot exceed target; malformed amounts cannot create a group', async () => {
  const item = await create();
  const endpoint = `/api/items/${item.id}/splitsies`;
  for (const amount of [0, -1, '0.001', '1e2', 'NaN', true, {}, '1000001', '1,50']) {
    assert.equal((await call(2, 'POST', endpoint, { amount })).status, 422);
    assert.equal((await call(2, 'GET', endpoint)).body.splitsies, null);
  }
  assert.equal((await call(2, 'POST', endpoint, { amount: '10', target: '5' })).status, 409);
  assert.equal((await call(2, 'GET', endpoint)).body.splitsies, null);
  assert.equal((await call(2, 'POST', endpoint, { amount: '20', target: '100' })).status, 201);
  const results = await Promise.all([call(3, 'PUT', endpoint, { amount: '60' }), call(4, 'PUT', endpoint, { amount: '60' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const group = (await call(2, 'GET', endpoint)).body.splitsies;
  assert.equal(group.total_cents, 8000);
  assert.equal(group.remaining_cents, 2000);
  const winner = group.participants.find(p => p.user_id !== 2).user_id;
  assert.equal((await call(winner, 'PUT', endpoint, { amount: '80' })).body.splitsies.remaining_cents, 0);
  assert.equal((await call(winner, 'PUT', endpoint, { amount: '80' })).body.splitsies.total_cents, 10000);
  assert.equal((await call(2, 'POST', '/api/items/1/splitsies', { amount: '5' })).status, 409);
  assert.equal((await call(1, 'DELETE', `/api/users/me/items/${item.id}`)).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM split_contributions WHERE item_id = ?').get(item.id).n, 0);
});

test('groups can have an open budget and normal claims remain anonymous', async () => {
  const item = await create();
  const started = await call(2, 'POST', `/api/items/${item.id}/splitsies`, { amount: '0.01' });
  assert.equal(started.status, 201);
  assert.equal(started.body.splitsies.target_cents, null);
  assert.equal((await call(3, 'PUT', `/api/items/${item.id}/splitsies`, { amount: '10.99' })).body.splitsies.total_cents, 1100);
  const normalClaim = (await call(3, 'GET', '/api/users/1/items')).body.find(i => i.id === 1);
  assert.equal(normalClaim.is_claimed, true);
  assert.equal(normalClaim.claimed_by_me, false);
  assert.equal(Object.hasOwn(normalClaim, 'claimer_id'), false);
  const ownerClaim = (await call(1, 'GET', '/api/users/1/items')).body.find(i => i.id === 1);
  assertPrivate(ownerClaim);
});

test('a simultaneous claim and splitsies start reserve the gift only once', async () => {
  const item = await create();
  const results = await Promise.all([
    call(2, 'POST', `/api/items/${item.id}/claim`),
    call(3, 'POST', `/api/items/${item.id}/splitsies`, { amount: '10' }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const claims = db.prepare('SELECT COUNT(*) AS n FROM claims WHERE item_id = ?').get(item.id).n;
  const groups = db.prepare('SELECT COUNT(*) AS n FROM splitsies WHERE item_id = ?').get(item.id).n;
  assert.equal(claims + groups, 1);
});

test('admin overview counts gifts, claims and splitsies without exposing identities', async () => {
  assert.equal((await call(0, 'GET', '/api/admin/stats')).status, 401);
  assert.equal((await call(1, 'GET', '/api/admin/stats')).status, 403);
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = 2').run();
  db.prepare('DELETE FROM wishlist_items').run();
  await create();
  const claimed = await create();
  const shared = await create();
  assert.equal((await call(3, 'POST', `/api/items/${claimed.id}/claim`)).status, 201);
  assert.equal((await call(4, 'POST', `/api/items/${shared.id}/splitsies`, { amount: '10', target: '50' })).status, 201);
  const result = await call(2, 'GET', '/api/admin/stats');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { gifts: 3, claims: 1, splitsies: 1, available: 1 });
  assert.equal((await call(4, 'PUT', `/api/items/${shared.id}/splitsies`, { amount: '50' })).status, 200);
  assert.deepEqual((await call(2, 'GET', '/api/admin/stats')).body, result.body);
  assert.equal((await call(4, 'DELETE', `/api/items/${shared.id}/splitsies`)).status, 200);
  assert.deepEqual((await call(2, 'GET', '/api/admin/stats')).body, { gifts: 3, claims: 1, splitsies: 0, available: 2 });
});
