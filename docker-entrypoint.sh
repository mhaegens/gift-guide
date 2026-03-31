#!/bin/sh
set -e

# Auto-generate SESSION_SECRET if not provided
if [ -z "$SESSION_SECRET" ]; then
  export SESSION_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
  echo "INFO: SESSION_SECRET not set — generated automatically for this container instance."
  echo "      Sessions will not survive container restarts. Set SESSION_SECRET in .env to persist them."
fi

# Initialize schema and seed admin user (both are idempotent)
node server/db/schema.js
node server/db/seed.js

exec node server/index.js
