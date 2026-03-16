# The Great Gift Guide — Product Requirements Document

**Version:** 1.1
**Date:** 2026-03-16
**Author:** Michiel Haegens
**Status:** Final Draft — Ready for Development

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Roles & Personas](#3-user-roles--personas)
4. [Core Privacy Model (The Secrecy Contract)](#4-core-privacy-model-the-secrecy-contract)
5. [Functional Requirements](#5-functional-requirements)
6. [Data Model](#6-data-model)
7. [API Design](#7-api-design)
8. [UI/UX Requirements](#8-uiux-requirements)
9. [Technical Architecture](#9-technical-architecture)
10. [Infrastructure & Deployment](#10-infrastructure--deployment)
11. [Security Considerations](#11-security-considerations)
12. [Future Expansions](#12-future-expansions)
13. [Confirmed Decisions Log](#13-confirmed-decisions-log)
14. [Glossary](#14-glossary)

---

## 1. Project Overview

The Great Gift Guide is a private family web application that lets family members maintain and share gift wishlists year-round. The goal is simple: people receive gifts they actually want, and buyers never duplicate purchases.

Each family member has a single persistent wishlist. There are no occasions, seasons, or events — items live on the list until deleted by the owner. Buyers browse any family member's list, filter by budget, and claim items they intend to buy. Claims are invisible to the wishlist owner (surprises preserved) and anonymous to everyone else.

The application will be self-hosted on a private LXC Debian container, publicly accessible at `gifts.haegens.be` via Cloudflare Tunnel. Intended exclusively for family use with closed (admin-only) registration.

---

## 2. Goals & Non-Goals

### Goals

- Each family member has one persistent wishlist, active all year
- Family members can view each other's wishlists
- Buyers can claim an item to prevent duplicate purchases
- Claimed status is hidden from the wishlist owner (secrecy preserved)
- Claimer identity is hidden from everyone except the claimer themselves
- Price-range filtering so buyers can shop within budget
- Gift items support free text, a product URL (with auto-enrichment), a description, and buyer notes
- Simple, mobile-friendly UI in English
- Self-hostable with minimal operational overhead on Debian LXC

### Non-Goals

- Occasion or event-based organisation (deliberately excluded — one list per person, always current)
- Public or open registration
- Full e-commerce features
- Real-time push notifications (MVP)
- Multi-family / multi-tenant support
- Enterprise-grade security (OAuth, MFA, audit logs)

---

## 3. User Roles & Personas

### 3.1 Admin

- One or more designated family members managing the server
- Can create, edit, and deactivate user accounts
- Can reset any user's password (temp password shared out-of-band, e.g. WhatsApp)
- Views all wishlists like a normal member — claim indicators visible (yes/no), claimer identity never visible
- Cannot bypass the secrecy model

> **Design decision:** Even admins do not see claimer identity. The secrecy model has no exceptions.

### 3.2 Member (standard family user)

- Logs in with username + password
- Manages their own single wishlist (add, edit, delete items)
- Views any other member's wishlist
- Claims and unclaims items on other members' wishlists
- Never sees claim indicators on their own items
- Never sees who claimed any item

### 3.3 Future: Read-Only Guest

- Extended family (grandparents, friends) with view + claim access but no wishlist of their own
- Out of scope for MVP

---

## 4. Core Privacy Model (The Secrecy Contract)

This is the most critical functional requirement. It is enforced **server-side** on every API response. Client-side hiding alone is insufficient — a technically inclined user could inspect API responses.

### 4.1 The Rules

| Viewer | Own items — claim status | Others' items — claimed indicator | Others' items — claimer identity |
|--------|--------------------------|-----------------------------------|----------------------------------|
| Wishlist owner | Hidden entirely | Visible (yes/no) | Hidden |
| Other member | Visible (yes/no) | Visible (yes/no) | Hidden |
| Claimer (on others' list) | n/a | Visible — knows it is their own claim | They know it's them |
| Admin | Same as other member | Visible (yes/no) | Hidden |

### 4.2 API Enforcement Contract

On every endpoint returning gift items, the server applies:

```js
if (requester.id === item.owner_id):
    strip all claim fields from response
else:
    include is_claimed: boolean
    include claimed_by_me: boolean  // true only if requester is the claimer
    // never include claimer_id, claimer name, or any identifying claim data
```

This logic lives in a dedicated `serializeItem(item, claim, requesterId)` function and is covered by unit tests.

### 4.3 The Claimer's Perspective

A user who has claimed an item sees, on the other person's list:

- The item marked as claimed
- A "You're buying this" indicator
- An option to unclaim

This does not reveal their identity to anyone else.

---

## 5. Functional Requirements

### 5.1 Authentication & Session Management

| ID | Requirement |
|----|-------------|
| AUTH-01 | Users authenticate with a username and password |
| AUTH-02 | Passwords are hashed with bcrypt (cost factor >= 12) |
| AUTH-03 | Sessions are server-side (HTTP-only cookies), not JWT |
| AUTH-04 | Session timeout after 30 days of inactivity (configurable) |
| AUTH-05 | Admin can set a temporary password; user is prompted to change it on first login |
| AUTH-06 | No self-registration — all accounts are created by Admin |
| AUTH-07 | The login page is the only publicly accessible route |
| AUTH-08 | Failed login attempts are rate-limited (max 10 per 15 minutes per IP) |

### 5.2 User Management (Admin)

| ID | Requirement |
|----|-------------|
| USR-01 | Admin can create a new user account (display name, username, temporary password) |
| USR-02 | Admin can deactivate an account (user can no longer log in; their wishlist remains visible to others) |
| USR-03 | Admin can reset any user's password to a new temporary value |
| USR-04 | Admin can assign or revoke the admin role |
| USR-05 | Any user can change their own display name and password from a profile page |

### 5.3 Wishlist Items

| ID | Requirement |
|----|-------------|
| ITEM-01 | Each user has exactly one wishlist, active at all times |
| ITEM-02 | A user can add a gift item to their own wishlist |
| ITEM-03 | Each item has: title (required), description (optional), URL (optional), buyer notes (optional), price category (required) |
| ITEM-04 | Price categories: Free / 0-20 / 20-50 / 50-100 / 100+ |
| ITEM-05 | No occasion tagging — items are always-on and relevant year-round |
| ITEM-06 | A user can edit any of their own items at any time |
| ITEM-07 | A user can delete any of their own items; deletion cascades and removes any existing claim |
| ITEM-08 | Items are displayed in reverse-chronological order by default (newest first) |
| ITEM-09 | No maximum item limit per wishlist |
| ITEM-10 | When a URL is entered, the system asynchronously fetches Open Graph metadata (title, image) |
| ITEM-11 | If an OG title is found and the title field is empty, it is suggested to the user (user can override) |
| ITEM-12 | OG image URL is stored and hotlinked directly in the item card — no server-side image storage |
| ITEM-13 | OG enrichment is async — the item is saved immediately; enrichment updates it in the background |
| ITEM-14 | "Notes for buyer" lets the owner add purchase instructions (e.g., "Size M, blue colourway, not the Pro version") |

### 5.4 Viewing Wishlists

| ID | Requirement |
|----|-------------|
| VIEW-01 | After login, users see a home screen listing all family members |
| VIEW-02 | Clicking a family member opens their single wishlist |
| VIEW-03 | Viewing your own wishlist shows all items with zero claim indicators |
| VIEW-04 | Viewing another member's wishlist shows items with claimed indicators but no claimer identity |
| VIEW-05 | Unclaimed items on another user's list display a "Buy this" action |
| VIEW-06 | Items the current user has claimed show "You're buying this" + Unclaim option |
| VIEW-07 | Items claimed by someone else show "Already claimed" — greyed out, no further action |
| VIEW-08 | Wishlists can be filtered by price category |
| VIEW-09 | Clicking an item card expands it to show full description, URL link, and buyer notes |

### 5.5 Claiming & Unclaiming

| ID | Requirement |
|----|-------------|
| CLAIM-01 | A user can claim any unclaimed item on another user's wishlist |
| CLAIM-02 | A user cannot claim items on their own wishlist |
| CLAIM-03 | An item can only be claimed by one person at a time |
| CLAIM-04 | A claimer can unclaim an item at any time |
| CLAIM-05 | Simultaneous claims are resolved by the DB UNIQUE constraint; the losing request receives HTTP 409 with a clear message |
| CLAIM-06 | A "My Purchases" view lists all items the current user has claimed across all wishlists, grouped by person |

### 5.6 URL / OG Enrichment

| ID | Requirement |
|----|-------------|
| OG-01 | When a URL is submitted, the server makes a background HTTP GET to fetch OG metadata |
| OG-02 | The server-side fetch avoids CORS issues and does not expose the user's IP to retailers |
| OG-03 | OG image URL is stored in the item record and hotlinked directly — no image is downloaded or stored server-side |
| OG-04 | If the OG image URL becomes unavailable, the item card shows a placeholder gracefully |
| OG-05 | Enrichment timeout is 3 seconds; failures are silently swallowed |
| OG-06 | The item is immediately saved and visible before enrichment completes |

---

## 6. Data Model

### 6.1 Entity Overview

```
users
  └─< wishlist_items  (one list per user, no occasion dimension)
        └─< claims    (at most one claim per item, from a different user)

sessions
```

The occasions model from earlier concept versions is not included — occasion tagging has been deliberately removed.

### 6.2 Table Definitions

#### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| username | TEXT UNIQUE NOT NULL | Login identifier |
| display_name | TEXT NOT NULL | Shown throughout the UI |
| password_hash | TEXT NOT NULL | bcrypt hash |
| is_admin | BOOLEAN | Default false |
| is_active | BOOLEAN | Default true; false = deactivated |
| force_password_change | BOOLEAN | True after admin password reset |
| created_at | DATETIME | |
| last_login_at | DATETIME | |

#### `wishlist_items`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| owner_id | INTEGER | FK -> users |
| title | TEXT NOT NULL | |
| description | TEXT | Optional, plain text |
| url | TEXT | Optional product link |
| og_image_url | TEXT | Hotlinked OG image URL, fetched async |
| buyer_notes | TEXT | Purchase instructions for buyer |
| price_category | TEXT NOT NULL | Enum: `free` / `0_20` / `20_50` / `50_100` / `100_plus` |
| sort_order | INTEGER | For future manual reordering; defaults to insertion order |
| created_at | DATETIME | |
| updated_at | DATETIME | |

#### `claims`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| item_id | INTEGER | FK -> wishlist_items — UNIQUE — enforces one claim per item at DB level |
| claimer_id | INTEGER | FK -> users |
| claimed_at | DATETIME | |

The `UNIQUE` constraint on `claims.item_id` is the primary mechanism for preventing duplicate claims and handling race conditions without application-level locking.

#### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | Cryptographically random token |
| user_id | INTEGER | FK -> users |
| created_at | DATETIME | |
| last_active_at | DATETIME | Updated on each authenticated request |
| expires_at | DATETIME | |

---

## 7. API Design

RESTful, JSON-based. All endpoints except `/api/auth/login` require a valid session cookie. The secrecy contract is enforced in every endpoint returning item data.

### 7.1 Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | `{ username, password }` sets session cookie |
| POST | `/api/auth/logout` | Invalidates current session |
| GET | `/api/auth/me` | Returns current user (`id`, `display_name`, `is_admin`, `force_password_change`) |
| POST | `/api/auth/change-password` | Changes own password; clears `force_password_change` flag |

### 7.2 Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Any | List all active users (`id`, `display_name` only) |
| POST | `/api/users` | Admin | Create user |
| PATCH | `/api/users/:id` | Admin or self | Update `display_name`, `is_admin`, `is_active` |
| POST | `/api/users/:id/reset-password` | Admin | Set temp password, set `force_password_change` |

### 7.3 Wishlist Items

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/:id/items` | Any | Get all items for a user — secrecy applied based on requester |
| POST | `/api/users/me/items` | Self | Add item to own wishlist |
| PATCH | `/api/users/me/items/:itemId` | Self | Edit own item |
| DELETE | `/api/users/me/items/:itemId` | Self | Delete own item (claim cascades) |
| POST | `/api/items/enrich` | Any | `{ url }` returns `{ title?, og_image_url? }` |

**Secrecy logic:**

```js
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
    claimed_by_me: claim?.claimer_id === requesterId,
    // claimer identity is NEVER included
  };
}
```

### 7.4 Claims

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/items/:itemId/claim` | Any (not owner) | Claim an item |
| DELETE | `/api/items/:itemId/claim` | Claimer only | Unclaim an item |
| GET | `/api/claims/mine` | Self | All items the current user has claimed |

### 7.5 Error Responses

| Scenario | Status | Message |
|----------|--------|---------|
| Not authenticated | 401 | "Please log in" |
| Not authorised | 403 | "Not allowed" |
| Item already claimed | 409 | "This item was just claimed by someone else" |
| Claiming own item | 403 | "You cannot claim your own items" |
| Item not found | 404 | "Item not found" |
| Validation error | 422 | Field-level error messages |

---

## 8. UI/UX Requirements

### 8.1 General Principles

- Mobile-first — family members browse wishlists on their phones, often in a shop
- Warm, friendly aesthetic — personal family tool, not a corporate dashboard
- Fast time-to-information — wishlist reachable in 2 taps from home screen
- English UI throughout
- Accessible to non-technical family members — clear labels, no jargon

### 8.2 Navigation Structure

```
Bottom navigation bar (mobile):
  [ Home ]  [ My List ]  [ My Purchases ]  [ Profile ]
```

### 8.3 Screen Descriptions

#### Login Screen

- Username + password fields, Login button
- "Forgot your password? Ask [admin name]" note
- No registration link

#### Home Screen

- Grid of family member cards (name + avatar initial or colour)
- Each card shows member name and item count ("8 items on their list")
- Tapping a card opens that person's wishlist

#### Wishlist Screen — Viewing Another Person's List

- Header: person's name, item count
- Filter bar: price category chips (All / Free / 0-20 / 20-50 / 50-100 / 100+)
- Item cards showing:
  - OG thumbnail (if available, hotlinked)
  - Title, price category badge, buyer notes snippet
  - Claim status: "Buy this" / "You're buying this + Unclaim" / "Already claimed"
- Tapping an item card expands to full description, "Open link" button, full buyer notes

#### My List Screen — Own Wishlist

- Same layout, but:
  - Zero claim indicators shown anywhere
  - Prominent "Add gift" floating action button
  - Each item has edit and delete icons
  - No claim-related UI

#### Add / Edit Item Form

- Title (required)
- URL (optional) with "Fetch details" button for OG enrichment
  - On success: shows fetched title suggestion and thumbnail preview
- Price category: segmented control (Free · 0-20 · 20-50 · 50-100 · 100+)
- Description (optional textarea)
- Notes for buyer (optional textarea — e.g., "Size M, not the Pro version, the blue one")
- Save / Cancel

#### My Purchases Screen

- All items the current user has claimed, grouped by person
- Item title, whose list, price category, Unclaim option
- Acts as personal shopping checklist

#### Profile Screen

- Change display name
- Change password (current password required)

#### Admin Panel

- User list: create / deactivate / reset-password per user
- Simple table layout

### 8.4 Mobile Details

- Touch targets >= 44px
- Bottom navigation bar for primary actions
- "Buy this" CTA is full-width on mobile item expansion
- OG images rendered at fixed aspect ratio with `object-fit: cover` to prevent layout shift

---

## 9. Technical Architecture

### 9.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js 20 LTS | Stable, broad ecosystem, easy self-host |
| Web framework | Express.js | Minimal, sufficient for this scope |
| Database | SQLite via `better-sqlite3` | Zero-ops, single file, ACID, perfect for <30 users |
| Query builder | Drizzle ORM | Lightweight, type-safe, excellent SQLite support |
| Session store | `express-session` + `connect-sqlite3` | Survives restarts; no Redis needed |
| Password hashing | `bcryptjs` | Cost factor 12 |
| Frontend | Vue 3 (Composition API) + Vite | Lightweight SPA, fast DX |
| CSS | Tailwind CSS | Utility-first, responsive, tree-shaken in production |
| HTTP (server) | Node built-in `fetch` | OG enrichment requests |
| Process manager | PM2 | Crash restart, log management, systemd integration |

### 9.2 Project Structure

```
gift-guide/
├── server/
│   ├── index.js
│   ├── db/
│   │   ├── schema.js
│   │   ├── migrations/
│   │   └── seed.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── items.js
│   │   └── claims.js
│   ├── middleware/
│   │   ├── requireAuth.js
│   │   ├── requireAdmin.js
│   │   └── rateLimiter.js
│   └── services/
│       └── ogEnricher.js
├── client/
│   ├── src/
│   │   ├── views/
│   │   ├── components/
│   │   ├── stores/
│   │   └── router/
│   └── vite.config.js
├── data/
│   └── gift-guide.db         # gitignored
├── .env.example
├── package.json
└── ecosystem.config.js
```

### 9.3 Build & Serve

- `vite build` outputs static assets to `server/public/`
- Express serves the Vue SPA from `/` and API routes from `/api/`
- Single Node.js process on port 3000
- Cloudflare Tunnel points to `http://localhost:3000`

### 9.4 OG Enrichment Flow

1. User saves item with a URL
2. Item written to DB immediately — user sees it right away
3. Server spawns async background task: fetch URL, parse OG tags
4. On success: `UPDATE item SET og_image_url, title suggestion`
5. Client re-fetches item after ~2s to pick up enriched data
6. On failure / timeout (3s): item stays as-is, no error shown

### 9.5 Race Condition Handling

Simultaneous claims are resolved by SQLite `UNIQUE` constraint on `claims.item_id`. The app catches the unique violation and returns HTTP 409 with a user-friendly message. No pessimistic locking needed.

---

## 10. Infrastructure & Deployment

### 10.1 LXC Container (Debian 12 Bookworm)

```
CPU:   1-2 cores
RAM:   512 MB
Disk:  4 GB
OS:    Debian 12 Bookworm
```

### 10.2 Setup Steps

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PM2
npm install -g pm2

# App
git clone <repo> /opt/gift-guide
cd /opt/gift-guide && npm install && npm run build

# Config
cp .env.example .env   # set SESSION_SECRET and ADMIN_INITIAL_PASSWORD

# Start
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd
```

### 10.3 Cloudflare Tunnel

```bash
# Install cloudflared, authenticate, create tunnel
cloudflared tunnel login
cloudflared tunnel create gift-guide
cloudflared tunnel route dns gift-guide gifts.haegens.be
cloudflared service install
```

Cloudflare handles TLS. No Nginx, no Certbot, no open ports on the container.

### 10.4 Backup

```bash
# Daily cron at 03:00 — backup the single SQLite file
0 3 * * * cp /opt/gift-guide/data/gift-guide.db \
  /backup/gift-guide-$(date +\%Y\%m\%d).db && \
  find /backup -name "gift-guide-*.db" -mtime +30 -delete
```

### 10.5 Environment Variables

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=<64-char-random-string>
SESSION_TTL_DAYS=30
DB_PATH=./data/gift-guide.db
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=<temp-password>
OG_FETCH_ENABLED=true
OG_FETCH_TIMEOUT_MS=3000
```

---

## 11. Security Considerations

Proportionate to a private family application.

| Area | Measure |
|------|---------|
| Passwords | bcrypt cost 12, never plaintext |
| Sessions | HTTP-only, Secure, SameSite=Lax, server-side store |
| CSRF | SameSite=Lax mitigates most risk |
| Rate limiting | Login: 10 attempts / 15 min / IP |
| Secrecy enforcement | `serializeItem()` strips claim data for item owners — unit tested |
| Input sanitisation | HTML-escaped in Vue bindings; URLs validated before OG fetch |
| HTTPS | Enforced by Cloudflare Tunnel |
| OG fetch safety | Server-side only; URLs validated to HTTP/HTTPS before fetching |
| Claimer anonymity | `claimer_id` never returned in any API response to a non-claimer — unit tested |
| Dependency hygiene | `npm audit` on each deployment |

---

## 12. Future Expansions

Out of scope for MVP; architecture does not preclude these.

### 12.1 Group / Split Claims

Multiple users partially claiming one expensive item. Requires replacing single-claim with a `claim_parts` model.

### 12.2 Received / Archive Status

Owner marks items as received. Keeps lists clean without deleting history.

### 12.3 Item Priority / Manual Ordering

Owner ranks items by priority. `sort_order` column is already in the schema.

### 12.4 Email / Push Notifications

Notify a claimer if an item they claimed is deleted or edited.

### 12.5 PWA / Home Screen Install

`manifest.json` + service worker for phone home screen installation. Low effort.

### 12.6 Read-Only Guest Access

Shareable account for extended family — view and claim but no own wishlist.

### 12.7 Occasion / Event Pages

If occasion-based views are ever wanted, they can be added without conflicting with the current model.

---

## 13. Confirmed Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Application URL | `gifts.haegens.be` |
| 2 | Owner visibility of own item claim status | No — full blind, no exceptions |
| 3 | Item limit per wishlist | None |
| 4 | OG enrichment timing | Async — item saved immediately, enrichment updates in background |
| 5 | Initial admin account | Seeded from env vars, force-change on first login |
| 6 | Occasion / event model | Removed — one persistent list per person, no occasion dimension |
| 7 | UI language | English |
| 8 | OG image handling | Hotlinked — store URL, render directly, no server-side image storage |

---

## 14. Glossary

| Term | Definition |
|------|------------|
| Wishlist | The single, always-current list of gift items belonging to one user |
| Item | A single gift suggestion on a wishlist |
| Claim | A buyer marking an item as "I am buying this" |
| Claimer | The user who has claimed an item |
| Secrecy Contract | The rule that claim status is hidden from the wishlist owner, and claimer identity is hidden from everyone except the claimer |
| OG Enrichment | Async server-side fetch of Open Graph metadata from a product URL |
| Hotlink | Rendering an image directly from its original URL without downloading or re-hosting it |
| Price Category | A budget range bracket (Free / 0-20 / 20-50 / 50-100 / 100+) used to filter items |
| Admin | A user with elevated privileges to manage accounts |
| My Purchases | Personal view showing all items the current user has claimed across all wishlists |

---

*End of Document — v1.1*
