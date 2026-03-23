# Deployment Setup Guide

This guide covers deploying Gift Guide on a Proxmox LXC container, exposed via a Cloudflare Tunnel at `https://gifts.haegens.be`. Estimated time: ~45 minutes.

All commands run as **root** unless otherwise noted.

---

## Prerequisites

Before starting, you need:

- Access to a Proxmox VE host (web UI or SSH)
- A Cloudflare account with the `haegens.be` domain
- The Git repository URL for this project (find it on GitHub: click the green **Code** button, then copy the HTTPS URL)

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
apt install -y git curl build-essential nano
```

Set the timezone:

```bash
timedatectl set-timezone Europe/Brussels
timedatectl status
# Expected: Time zone: Europe/Brussels (CET, +0100)
```

Make nano your default text editor for all commands that open one:

```bash
update-alternatives --set editor /usr/bin/nano
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

PM2 is the program that keeps your app running in the background and restarts it automatically if it ever crashes.

```bash
npm install -g pm2
```

Verify:

```bash
pm2 -v
# Expected: 5.x.x
```

---

## 5. Clone the Repository and Install Dependencies

This step downloads the code and installs all the pieces it needs to run.

```bash
git clone <your-repo-url> /opt/gift-guide
```

Replace `<your-repo-url>` with the HTTPS URL you copied from GitHub (it will look like `https://github.com/yourname/gift-guide.git`).

Install the server dependencies:

```bash
cd /opt/gift-guide
npm install
```

Install the frontend dependencies:

```bash
cd /opt/gift-guide/client
npm install
```

---

## 6. Build the Frontend

This compiles the website into static files that the server will deliver to visitors. You only need to do this once on first install (and again whenever you update the app).

```bash
cd /opt/gift-guide
npm run build
```

Expected output: Vite prints build statistics and creates a `public/` folder inside `/opt/gift-guide`. That folder contains the compiled website.

---

## 7. Configure Environment Variables

Environment variables tell the app how to run — things like which port to listen on and what secret to use for login sessions.

```bash
cd /opt/gift-guide
cp .env.example .env
nano .env
```

The file will open in the nano text editor. You need to fill in the values described below.

First, generate a secure session secret by opening a **second terminal window** (or tab) and running:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the long string of letters and numbers it prints. That is your `SESSION_SECRET`.

Back in the nano editor, update the file so it looks like this (replace the placeholders):

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=<paste the generated hex string here>
SESSION_TTL_DAYS=30
DB_PATH=./data/gift-guide.db
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=<choose a strong temporary password>
OG_FETCH_ENABLED=true
OG_FETCH_TIMEOUT_MS=3000
```

Save and close: press **Ctrl+X**, then **Y**, then **Enter**.

---

## 8. Initialize the Database

This creates the database file that the app uses to store wishlists, users, and gift claims.

```bash
cd /opt/gift-guide
mkdir -p /opt/gift-guide/data
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

## 9. Start the Application with PM2

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

## 10. Configure PM2 to Start on Boot

This makes PM2 (and your app) start automatically when the container reboots, so you never have to start it manually again.

Save the current PM2 process list:

```bash
pm2 save
# Expected: [PM2] Saving current process list...
```

Generate the systemd startup command:

```bash
pm2 startup systemd
```

This prints a long command starting with `sudo env PATH=...`. **Copy that entire line and paste it back into the terminal, then press Enter.** The command is personalised to your system — do not retype it by hand. It will look something like this (yours may differ slightly):

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

## 11. Install cloudflared

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

## 12. Configure the Cloudflare Tunnel

This connects your app to the internet through Cloudflare, without opening any firewall ports.

Authenticate with Cloudflare:

```bash
cloudflared tunnel login
```

This prints a long URL. **Copy it and open it in a browser on your own computer** (not in the terminal — the server has no browser). Log in to Cloudflare and authorise the `haegens.be` domain. When you see a success message in the browser, come back to the terminal. A certificate is saved to `/root/.cloudflared/cert.pem`.

Create the tunnel:

```bash
cloudflared tunnel create gift-guide
```

The output will include a line like:

```
Created tunnel gift-guide with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Copy that UUID** (the long string of letters and numbers after `with id`). You will need it in the next step.

Create the tunnel configuration file:

```bash
mkdir -p /etc/cloudflared
nano /etc/cloudflared/config.yml
```

Paste the following, replacing `<TUNNEL-UUID>` with the UUID you just copied (both times it appears):

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

## 13. Install cloudflared as a System Service

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

## 14. Verify the Full Stack

Open a browser and navigate to:

```
https://gifts.haegens.be
```

Expected:
1. The login screen loads over HTTPS (Cloudflare handles the certificate).
2. Log in with `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD`.
3. You are immediately prompted to change your password.
4. After changing your password, you are logged in and the home screen appears.

---

## 15. Set Up Daily Database Backup

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

Save and close, then make it executable and create the backup folder:

```bash
chmod +x /opt/backup-gift-guide.sh
mkdir -p /backup
```

Test it manually:

```bash
bash /opt/backup-gift-guide.sh && ls /backup/
# Expected: gift-guide-YYYYMMDD.db
```

Add to crontab (the system scheduler) to run every night at 3:00 AM:

```bash
crontab -e
```

Nano will open. Use the arrow keys to move to the very last line of the file, then add this line:

```
0 3 * * * /opt/backup-gift-guide.sh
```

Save and close: **Ctrl+X**, **Y**, **Enter**.

---

## 16. Ongoing Maintenance

**Update the application** (after pulling new code from Git):

```bash
cd /opt/gift-guide
git pull
npm install
npm run build
pm2 restart gift-guide
```

> Note: `npm run build` recompiles the frontend. Without it, any visual changes in an update will not appear for users.

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

## 17. Troubleshooting

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
