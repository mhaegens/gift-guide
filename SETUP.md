# Deployment Setup Guide

This guide covers deploying Gift Guide on a Proxmox LXC container, exposed via a Cloudflare Tunnel at `https://gifts.haegens.be`. Estimated time: ~45 minutes.

All commands run as **root** unless otherwise noted.

---

## Prerequisites

Before starting, you need:

- Access to a Proxmox VE host (web UI or SSH)
- A Cloudflare account with the `haegens.be` domain
- The Git repository URL for this project

---

## 1. Create the LXC Container in Proxmox

1. Log into the Proxmox web UI.
2. Go to **Datacenter → your node → CT Templates**.
3. Click **Templates** and download the **Debian 12 Bookworm** template if not already present.
4. Click **Create CT** and use these settings:
   - **Hostname:** `gift-guide`
   - **Password:** set a strong root password
   - **Template:** Debian 12 Bookworm
   - **Disk:** 4 GB
   - **CPU:** 1 core
   - **Memory:** 512 MB
   - **Network:** bridge `vmbr0`, DHCP (or static IP if preferred)
   - **Unprivileged container:** ✓ checked
5. Click **Finish**, then start the container.
6. Open the container console via **>_ Console** in the Proxmox UI.

---

## 2. Initial System Setup

```bash
apt update && apt upgrade -y
apt install -y git curl build-essential
```

Set the timezone:

```bash
timedatectl set-timezone Europe/Brussels
timedatectl status
# Expected: Time zone: Europe/Brussels (CET, +0100)
```

---

## 3. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verify:

```bash
node -v
# Expected: v20.x.x

npm -v
# Expected: 10.x.x
```

---

## 4. Install PM2 Globally

```bash
npm install -g pm2
```

Verify:

```bash
pm2 -v
# Expected: 5.x.x
```

---

## 5. Clone the Repository

```bash
git clone <your-repo-url> /opt/gift-guide
cd /opt/gift-guide
npm install
```

Expected output: npm lists installed packages with no errors.

---

## 6. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Generate a secure session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as `SESSION_SECRET` in `.env`.

Fill in all values:

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=<paste generated hex string here>
SESSION_TTL_DAYS=30
DB_PATH=./data/gift-guide.db
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=<choose a strong temporary password>
OG_FETCH_ENABLED=true
OG_FETCH_TIMEOUT_MS=3000
```

Save and close: **Ctrl+X**, then **Y**, then **Enter**.

---

## 7. Initialize the Database

```bash
mkdir -p /opt/gift-guide/data
cd /opt/gift-guide
npm run db:init
# Expected: Database schema initialised at /opt/gift-guide/data/gift-guide.db

npm run db:seed
# Expected: Admin user "admin" created. Password change required on first login.
```

Verify the database file was created:

```bash
ls -lh /opt/gift-guide/data/
# Expected: gift-guide.db  (a few KB)
```

---

## 8. Start the Application with PM2

```bash
cd /opt/gift-guide
pm2 start ecosystem.config.js
```

Check status:

```bash
pm2 status
# Expected: gift-guide  online  0s  ...
```

Test that the server is responding:

```bash
curl http://localhost:3000/api/auth/me
# Expected: {"error":"Please log in"}  (HTTP 401 — server is running)
```

---

## 9. Configure PM2 to Start on Boot

Save the current PM2 process list:

```bash
pm2 save
# Expected: [PM2] Saving current process list...
```

Generate the systemd startup command:

```bash
pm2 startup systemd
```

This prints a command starting with `sudo env PATH=...`. **Copy and run that exact command.** Example:

```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

Test by rebooting:

```bash
reboot
```

After the container restarts, SSH back in (or use the Proxmox console) and verify:

```bash
pm2 status
# Expected: gift-guide  online
```

---

## 10. Install cloudflared

Download and install the cloudflared Debian package:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb
```

Verify:

```bash
cloudflared --version
# Expected: cloudflared version 202x.x.x
```

---

## 11. Configure the Cloudflare Tunnel

Authenticate with Cloudflare (this opens a browser link — copy it and open on your machine):

```bash
cloudflared tunnel login
```

Follow the browser prompt to authorise the domain `haegens.be`. A certificate is saved to `/root/.cloudflared/cert.pem`.

Create the tunnel:

```bash
cloudflared tunnel create gift-guide
```

Note the tunnel UUID printed in the output — you will need it in the next step.

Create the tunnel configuration file:

```bash
mkdir -p /etc/cloudflared
nano /etc/cloudflared/config.yml
```

Paste the following, replacing `<TUNNEL-UUID>` with the UUID from the previous step:

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /root/.cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: gifts.haegens.be
    service: http://localhost:3000
  - service: http_status:404
```

Save and close: **Ctrl+X**, **Y**, **Enter**.

Route the DNS record:

```bash
cloudflared tunnel route dns gift-guide gifts.haegens.be
```

Verify in your Cloudflare dashboard under **DNS** that a CNAME record for `gifts` pointing to `<TUNNEL-UUID>.cfargotunnel.com` was created.

---

## 12. Install cloudflared as a System Service

```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

Check that it is running:

```bash
systemctl status cloudflared
# Expected: Active: active (running)
```

---

## 13. Verify the Full Stack

Open a browser and navigate to:

```
https://gifts.haegens.be
```

Expected:
1. The login screen loads over HTTPS (Cloudflare handles the certificate).
2. Log in with `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD`.
3. You are immediately prompted to change your password (`force_password_change` flag).
4. After changing your password, you are logged in and the home screen appears.

---

## 14. Set Up Daily Database Backup

Create the backup script:

```bash
nano /opt/backup-gift-guide.sh
```

Paste:

```bash
#!/bin/bash
cp /opt/gift-guide/data/gift-guide.db /backup/gift-guide-$(date +%Y%m%d).db
find /backup -name "gift-guide-*.db" -mtime +30 -delete
```

Save and close, then make it executable:

```bash
chmod +x /opt/backup-gift-guide.sh
mkdir -p /backup
```

Test it manually:

```bash
bash /opt/backup-gift-guide.sh && ls /backup/
# Expected: gift-guide-YYYYMMDD.db
```

Add to crontab:

```bash
crontab -e
```

Add this line at the bottom:

```
0 3 * * * /opt/backup-gift-guide.sh
```

Save and close.

---

## 15. Ongoing Maintenance

**Update the application:**

```bash
cd /opt/gift-guide
git pull
npm install
pm2 restart gift-guide
```

**View live logs:**

```bash
pm2 logs gift-guide
```

**View error logs only:**

```bash
pm2 logs gift-guide --err
```

**Inspect the database:**

```bash
apt install -y sqlite3
sqlite3 /opt/gift-guide/data/gift-guide.db
sqlite> .tables
sqlite> SELECT id, username, is_admin FROM users;
sqlite> .quit
```

**Restart the app:**

```bash
pm2 restart gift-guide
```

**Stop the app:**

```bash
pm2 stop gift-guide
```

---

## 16. Troubleshooting

**App not starting:**

```bash
pm2 logs gift-guide --err --lines 50
```

Common cause: `.env` file missing or `SESSION_SECRET` not set.

**Cannot reach `gifts.haegens.be`:**

```bash
systemctl status cloudflared
journalctl -u cloudflared -n 50
```

Check that the tunnel UUID in `/etc/cloudflared/config.yml` matches the JSON credentials file in `/root/.cloudflared/`.

**Login failing:**

```bash
sqlite3 /opt/gift-guide/data/gift-guide.db "SELECT id, username FROM users;"
```

If empty, the database was not seeded. Run `npm run db:seed` from `/opt/gift-guide`.

**Database locked errors:**

```bash
pm2 list
```

Ensure only one instance of `gift-guide` is running. If multiple instances show, run:

```bash
pm2 delete gift-guide
pm2 start ecosystem.config.js
pm2 save
```

**Port already in use:**

```bash
lsof -i :3000
```

Kill the conflicting process or change `PORT` in `.env`.
