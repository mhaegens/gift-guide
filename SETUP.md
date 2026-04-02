# Deployment Setup Guide

This guide covers deploying Gift Guide using Docker on any Linux host, exposed via a Cloudflare Tunnel at `https://gifts.haegens.be`. Estimated time: ~10 minutes (excluding Cloudflare Tunnel setup, which is external infrastructure).

---

## Prerequisites

- Docker and Docker Compose installed on the host
- SSH access to the host
- A Cloudflare Tunnel already configured to forward `https://gifts.haegens.be` → `http://localhost:3000` (see [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/))

---

## 1. Clone the Repository

```bash
git clone <your-repo-url> /opt/gift-guide
cd /opt/gift-guide
```

Replace `<your-repo-url>` with the HTTPS URL from GitHub.

---

## 2. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

You must set at minimum:

```env
NODE_ENV=production
SESSION_SECRET=<generated-hex-string>
ADMIN_INITIAL_PASSWORD=<choose a strong temporary password>
```

Generate a secure `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Important:** Set `SESSION_SECRET` explicitly. If left blank the container will auto-generate one on startup, but it will change on every restart — logging all users out each time the container is restarted.

The other values in `.env.example` have safe defaults and do not need to be changed for a standard deployment.

Save and close: **Ctrl+X**, **Y**, **Enter**.

---

## 3. Start the Application

```bash
docker compose up -d --build
```

Docker will build the image, initialise the database, and start the app. The `./data/` directory on the host is mounted into the container so the SQLite database persists across restarts and image rebuilds.

---

## 4. Verify

Check that the container is running:

```bash
docker compose ps
# Expected: app  running  0.0.0.0:3000->3000/tcp
```

Check the startup logs:

```bash
docker compose logs app
```

Expected output includes lines like:
```
Database schema initialised at /app/data/gift-guide.db
Admin user "admin" created. Password change required on first login.
Gift Guide listening on port 3000
```

Test the API directly:

```bash
curl http://localhost:3000/api/auth/me
# Expected: {"error":"Please log in"}  (HTTP 401 — server is running)
```

If the Cloudflare Tunnel is active, open `https://gifts.haegens.be` in a browser. Log in with `admin` / the password you set in `.env`. You will be prompted to change your password on first login.

---

## 5. Updating the Application

```bash
cd /opt/gift-guide
git pull
docker compose up -d --build
```

Docker rebuilds the image (including the frontend) and replaces the running container. The database is preserved via the host volume.

---

## 6. Daily Database Backup

The database file lives at `./data/gift-guide.db` on the host. Back it up with a cron job:

```bash
nano /opt/backup-gift-guide.sh
```

Paste:

```bash
#!/bin/bash
cp /opt/gift-guide/data/gift-guide.db /backup/gift-guide-$(date +%Y%m%d).db
find /backup -name "gift-guide-*.db" -mtime +30 -delete
```

Save and close, then make it executable and create the backup folder:

```bash
chmod +x /opt/backup-gift-guide.sh
mkdir -p /backup
```

Test manually:

```bash
bash /opt/backup-gift-guide.sh && ls /backup/
# Expected: gift-guide-YYYYMMDD.db
```

Schedule it to run every night at 3:00 AM:

```bash
crontab -e
```

Add this line at the end:

```
0 3 * * * /opt/backup-gift-guide.sh
```

---

## 7. Ongoing Maintenance

**View live logs:**

```bash
docker compose logs -f app
```

**View error output only:**

```bash
docker compose logs app 2>&1 | grep -i error
```

**Restart the app:**

```bash
docker compose restart app
```

**Stop the app:**

```bash
docker compose down
```

**Inspect the database:**

```bash
docker compose exec app sh -c "sqlite3 data/gift-guide.db"
sqlite> .tables
sqlite> SELECT id, username, is_admin FROM users;
sqlite> .quit
```

Or directly on the host (if `sqlite3` is installed):

```bash
sqlite3 /opt/gift-guide/data/gift-guide.db "SELECT id, username, is_admin FROM users;"
```

---

## 8. Troubleshooting

**Container not starting:**

```bash
docker compose logs app
```

Common causes: `.env` missing, `ADMIN_INITIAL_PASSWORD` not set, or port 3000 already in use on the host.

**Port already in use:**

```bash
lsof -i :3000
```

Kill the conflicting process, or change the host-side port in `docker-compose.yml` (e.g. `"3001:3000"`) and update the Cloudflare Tunnel config accordingly.

**Cannot reach `gifts.haegens.be`:**

First confirm the app itself is responding locally:

```bash
curl http://localhost:3000/api/auth/me
```

If that works, the issue is with the Cloudflare Tunnel, not the app. Check the tunnel service on the host.

**Login failing / no admin user:**

```bash
docker compose logs app | grep -i seed
```

If the seed step did not run, restart the container — the entrypoint runs schema initialisation and seeding automatically on every start (both operations are idempotent).

**Sessions lost after restart:**

Set `SESSION_SECRET` to a fixed value in `.env` (see step 2). Without it, a new secret is generated on each startup.
