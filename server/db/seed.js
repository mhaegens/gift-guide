'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./schema');

const username = process.env.ADMIN_INITIAL_USERNAME;
const password = process.env.ADMIN_INITIAL_PASSWORD;

if (!username || !password) {
  console.error('ADMIN_INITIAL_USERNAME and ADMIN_INITIAL_PASSWORD must be set in .env');
  process.exit(1);
}

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  console.log(`Admin user "${username}" already exists — skipping seed.`);
} else {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare(`
    INSERT INTO users (username, display_name, password_hash, is_admin, force_password_change)
    VALUES (?, ?, ?, 1, 1)
  `).run(username, username, hash);
  console.log(`Admin user "${username}" created. Password change required on first login.`);
}

if (require.main === module) {
  db.close();
}
