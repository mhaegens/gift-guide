# The Great Gift Guide

A private family wishlist app with anonymous gift claims — self-hosted, mobile-first, no surprises spoiled.

> **Full specification:** [`gift-guide.PRD.md`](./gift-guide.PRD.md)

---

## What it is

Each family member has one persistent wishlist, active all year. Anyone in the family can browse any other member's list, filter by budget, and **claim** an item to signal "I'm buying this."

This is a private family application — not intended for public use or open registration.

---

## The Secrecy Model

This is the core design constraint enforced server-side, not just in the UI:

| Who sees what | Claim status | Claimer identity |
|--------------|-------------|-----------------|
| **Wishlist owner** | Hidden — they never know if their items are claimed | Hidden |
| **Other family members** | Visible (claimed / unclaimed) | Hidden — only "claimed by me" or "claimed by someone else" |
| **The claimer** | Sees their own claims in "My Purchases" | Knows it's them |

The `serializeItem()` function strips claim data for owners on every API response. It cannot be bypassed client-side.

---

## Features

- **Personal wishlists** — one always-active list per family member
- **Anonymous claim system** — prevent duplicate purchases without spoiling surprises
- **Budget filtering** — Free / €0–20 / €20–50 / €50–100 / €100+
- **OG enrichment** — paste a product URL, auto-fetch title and thumbnail
- **My Purchases view** — personal shopping checklist of all claimed items, grouped by person
- **Admin panel** — create accounts, reset passwords, manage roles, deactivate members
- **Mobile-first UI** — designed for browsing wishlists in a shop

---

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | UI POC — vanilla HTML/CSS/JS | ✅ Done |
| 2 | Backend — Express + SQLite API | 🔄 In Progress |
| 3 | Frontend — Vue 3 + Vite | Pending |
| 4 | Deployment — Debian LXC + PM2 + Cloudflare Tunnel | Pending |

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js 20 LTS | |
| Framework | Express.js | |
| Database | SQLite via `better-sqlite3` | Raw SQL — no ORM |
| Sessions | `express-session` + `connect-sqlite3` | HTTP-only cookies, SameSite=Lax |
| Passwords | `bcryptjs` cost 12 | Never stored plaintext |
| Frontend (Phase 3) | Vue 3 + Vite | Not yet built |
| CSS | Tailwind CSS | |
| Process manager | PM2 | |

---

## Project Structure

Current state (Phase 1–2):

```
gift-guide/
├── poc/
│   └── index.html              # Phase 1 UI POC — open directly in a browser
├── server/
│   ├── index.js                # Express entry point
│   ├── db/
│   │   ├── schema.js           # DB connection + CREATE TABLE IF NOT EXISTS
│   │   └── seed.js             # Creates initial admin user
│   ├── routes/
│   │   ├── auth.js             # /api/auth/*
│   │   ├── users.js            # /api/users/*
│   │   ├── items.js            # /api/users/*/items, /api/items/enrich
│   │   └── claims.js           # /api/items/*/claim, /api/claims/mine
│   ├── middleware/
│   │   ├── requireAuth.js
│   │   ├── requireAdmin.js
│   │   └── rateLimiter.js
│   └── services/
│       └── ogEnricher.js       # Async OG metadata fetcher
├── data/
│   └── gift-guide.db           # SQLite database (gitignored)
├── .env.example
├── package.json
├── ecosystem.config.js         # PM2 config
├── SETUP.md                    # Step-by-step deployment guide
└── gift-guide.PRD.md           # Full product specification
```

Planned addition for Phase 3:

```
├── client/
│   └── src/
│       ├── views/
│       ├── components/
│       ├── stores/
│       └── router/
```

---

## Viewing the POC (Phase 1)

No server or build step required:

```bash
open poc/index.html
# or on Linux:
xdg-open poc/index.html
```

**Demo credentials:** Any username and password logs you in as Michiel (admin).

**What to explore:**
- Home screen → tap a family member → their wishlist slides in as a card on top
- Tap "Buy this" to claim an item, "Unclaim" to release it
- "My List" tab → add, edit, delete your own items (no claim indicators shown to owner)
- "My Purchases" tab → all items you've claimed, grouped by person
- "Profile" → admin users can open the Admin Panel
- Price filter chips to filter any wishlist by budget

---

## Developer Quickstart (Phase 2+)

Prerequisites: Node.js 20, npm.

```bash
git clone <repo-url> gift-guide
cd gift-guide
npm install
cp .env.example .env
```

Edit `.env` — at minimum set `SESSION_SECRET` (generate with the command in the file) and `ADMIN_INITIAL_PASSWORD`.

```bash
npm run db:init    # create tables
npm run db:seed    # create admin user from .env credentials
npm run dev        # start server with nodemon on port 3000
```

Test the API:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<your-password>"}'
```

---

## Deployment

Self-hosted on a Debian 12 LXC container, accessible at `https://gifts.haegens.be` via Cloudflare Tunnel (no open ports, no Nginx).

See **[SETUP.md](./SETUP.md)** for the complete step-by-step deployment guide.

---

## Full Specification

See **[gift-guide.PRD.md](./gift-guide.PRD.md)** for the complete product requirements, data model, API design, and security considerations.

---

*Private family application — not intended for public use.*
