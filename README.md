# The Great Gift Guide

A private family web application for managing gift wishlists year-round. Family members maintain a personal wishlist, browse each other's lists, and claim items they intend to buy — all without spoiling surprises.

> **Full specification:** [`gift-guide.PRD.md`](./gift-guide.PRD.md)

---

## Current Status: UI POC

The first milestone is complete: a fully interactive **static HTML proof-of-concept** (`poc.html`) that demonstrates all screens and interactions without any server-side code.

### View the POC

Open `poc.html` directly in any browser — no server or build step required.

### What the POC demonstrates

| Screen | Description |
|--------|-------------|
| **Login** | Username + password form |
| **Home** | Family member grid with item counts |
| **Wishlist (others)** | Browse another member's list with price filter and claim buttons |
| **My List** | Own wishlist — zero claim indicators (secrecy contract active) |
| **Add / Edit Item** | Form with mock OG URL enrichment (1-second simulated fetch) |
| **My Purchases** | All items the current user has claimed, grouped by person |
| **Profile** | Change display name and password |
| **Admin Panel** | Manage family members (create, deactivate, reset password, toggle admin) |

### The Secrecy Contract

The core privacy model is demonstrated in the POC via a **demo user switcher** (banner at the top). Switch between Emma, Liam, Sophie, Dad, and Admin to observe:

- Viewing your **own list** → no claim indicators shown anywhere
- Viewing **another member's list** → items show as "Buy this", "You're buying this · Unclaim", or "Already claimed"
- **Claimer identity** is never revealed to anyone other than the claimer themselves

This mirrors the server-side `serializeItem()` logic described in the PRD.

---

## Planned Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS |
| Web framework | Express.js |
| Database | SQLite via `better-sqlite3` |
| ORM | Drizzle ORM |
| Sessions | `express-session` + `connect-sqlite3` |
| Frontend | Vue 3 (Composition API) + Vite |
| CSS | Tailwind CSS |
| Process manager | PM2 |
| Tunnel | Cloudflare Tunnel → `gifts.haegens.be` |

---

## Roadmap

- [x] **Step 1 — UI POC** (`poc.html`): All screens, mock data, secrecy contract demo
- [ ] **Step 2 — Backend**: Express server, SQLite schema, REST API, session auth
- [ ] **Step 3 — Frontend**: Vue 3 + Vite SPA, wired to real API
- [ ] **Step 4 — Deployment**: PM2, Cloudflare Tunnel, backup cron

---

## Development

Each step will be documented here as the project progresses.
