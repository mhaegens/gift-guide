# The Great Gift Guide

A private family web application for managing gift wishlists year-round. Family members maintain a personal wishlist, browse each other's lists, and claim items they intend to buy — all without spoiling surprises.

> **Full specification:** [`gift-guide.PRD.md`](./gift-guide.PRD.md)

---

## What it does

Each family member has one persistent wishlist, active all year. Anyone in the family can browse any other member's list, filter by budget, and **claim** an item to signal "I'm buying this". Claims are:

- **Invisible to the wishlist owner** — surprises preserved
- **Anonymous to everyone else** — only the claimer knows they claimed it

---

## Key features

- **Personal wishlists** — one always-active list per family member
- **Claim system** — prevent duplicate purchases with built-in secrecy
- **Budget filtering** — filter by Free / €0–20 / €20–50 / €50–100 / €100+
- **OG enrichment** — paste a product URL, auto-fetch title and thumbnail
- **My Purchases view** — personal shopping checklist of all claimed items
- **Admin panel** — create accounts, reset passwords, manage roles
- **Mobile-first** — designed for browsing wishlists in a shop

---

## Project status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | UI POC (this step) | ✅ Done |
| 2 | Backend — Express + SQLite + API | Pending |
| 3 | Frontend — Vue 3 + Vite (connected to API) | Pending |
| 4 | Deployment — Debian LXC + PM2 + Cloudflare Tunnel | Pending |

---

## Viewing the POC

No server or build step required — just open the file directly:

```bash
open poc/index.html
# or on Linux:
xdg-open poc/index.html
```

**Demo credentials:** Any username and password will work — it logs you in as Michiel (admin).

**What to explore:**
- Home screen → tap a family member → see their wishlist with claim states
- Tap "Buy this" to claim an item, "Unclaim" to release it
- "My List" tab → add, edit, delete your own items (no claim indicators shown)
- "My Purchases" tab → all items you've claimed, grouped by person
- "Profile" → admin users can access the Admin Panel
- Price filter chips to filter any wishlist by budget

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS |
| Web framework | Express.js |
| Database | SQLite via `better-sqlite3` |
| Query builder | Drizzle ORM |
| Session store | `express-session` + `connect-sqlite3` |
| Password hashing | `bcryptjs` (cost factor 12) |
| Frontend | Vue 3 (Composition API) + Vite |
| CSS | Tailwind CSS |
| Process manager | PM2 |

---

## Project structure

```
gift-guide/
├── poc/
│   └── index.html          # ← UI POC (current phase)
├── server/                 # ← Phase 2 (not yet built)
│   ├── index.js
│   ├── db/
│   │   ├── schema.js
│   │   └── migrations/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── items.js
│   │   └── claims.js
│   ├── middleware/
│   └── services/
│       └── ogEnricher.js
├── client/                 # ← Phase 3 (not yet built)
│   └── src/
│       ├── views/
│       ├── components/
│       ├── stores/
│       └── router/
├── data/
│   └── gift-guide.db       # gitignored
├── .env.example
├── package.json
└── ecosystem.config.js
```

---

## Development (Phase 2+)

```bash
npm install
cp .env.example .env    # set SESSION_SECRET
npm run dev             # starts Express + Vite dev server
```

---

## Deployment

Self-hosted on a Debian 12 LXC container, publicly accessible at `gifts.haegens.be` via Cloudflare Tunnel. See [`gift-guide.PRD.md`](./gift-guide.PRD.md) §10 for full deployment instructions.
