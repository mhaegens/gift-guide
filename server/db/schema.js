'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(process.env.DB_PATH || './data/gift-guide.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    username              TEXT    UNIQUE NOT NULL,
    display_name          TEXT    NOT NULL,
    password_hash         TEXT    NOT NULL,
    is_admin              INTEGER NOT NULL DEFAULT 0,
    is_active             INTEGER NOT NULL DEFAULT 1,
    force_password_change INTEGER NOT NULL DEFAULT 0,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at         DATETIME
  );

  CREATE TABLE IF NOT EXISTS wishlist_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          TEXT    NOT NULL,
    description    TEXT,
    url            TEXT,
    og_image_url   TEXT,
    buyer_notes    TEXT,
    price_category TEXT    NOT NULL,
    sort_order     INTEGER DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS claims (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     INTEGER NOT NULL UNIQUE REFERENCES wishlist_items(id) ON DELETE CASCADE,
    claimer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claimed_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// When this file is run directly (npm run db:init), log confirmation
if (require.main === module) {
  console.log('Database schema initialised at', dbPath);
  db.close();
}

module.exports = db;
