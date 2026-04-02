# Gift Guide — Complete Installation Guide

This guide takes you from **zero** to a fully working Gift Guide instance at
`https://gifts.haegens.be` — running inside a fresh Debian 12 LXC container
on your `pve-homelab` Proxmox node, exposed via the existing **homelab** Cloudflare
Tunnel you already use for Home Assistant, Jellyfin, and Requestr.

By the end you will have added one more service to your tunnel:

```
pve-homelab
  ├── cloudflared (systemd) ── homelab tunnel ──► Cloudflare ──► internet
  │     └── ingress rules:
  │           ha.haegens.be       → 192.168.0.184:8123   (existing)
  │           jellyfin.haegens.be → 192.168.0.X:8096     (existing)
  │           requests.haegens.be → 192.168.0.X:3000     (existing)
  │           gifts.haegens.be    → 192.168.0.X:3000     ← new
  │
  └── CT 181 (gift-guide) — Debian 12, 1 vCPU, 1 GB RAM, 8 GB disk
        └── gift-guide container  (port 3000)
```

No new tunnel, no new token, no Docker cloudflared sidecar — just an extra
line in `/etc/cloudflared/config.yml`.

---

## What you need before you start

- Access to the Proxmox web UI (`https://<your-proxmox-ip>:8006`)
- SSH or shell access to `pve-homelab` (for editing the cloudflared config at the end)
- That's it — no external accounts or API tokens needed

---

## Step 1 — Create the LXC container in Proxmox

Open the Proxmox web UI at `https://<your-proxmox-ip>:8006` and log in.

### 1a. Open the Create CT wizard

Click the blue **"Create CT"** button in the top-right corner of the page.

### 1b. General tab

| Field | Value |
|---|---|
| Node | `pve-homelab` |
| CT ID | `181` |
| Hostname | `gift-guide` |
| Unprivileged container | ✅ **checked** |
| Password | choose a root password and write it down |

Click **Next**.

### 1c. Template tab

| Field | Value |
|---|---|
| Storage | `local` |
| Template | `debian-12-standard_12.12-1_amd64.tar.zst` |

> This template is already downloaded on your node — it will appear in the
> dropdown immediately.

Click **Next**.

### 1d. Disks tab

| Field | Value |
|---|---|
| Storage | `local-lvm` |
| Disk size (GiB) | `8` |

Click **Next**.

### 1e. CPU tab

| Field | Value |
|---|---|
| Cores | `1` |

Click **Next**.

### 1f. Memory tab

| Field | Value |
|---|---|
| Memory (MiB) | `1024` |
| Swap (MiB) | `512` |

Click **Next**.

### 1g. Network tab

| Field | Value |
|---|---|
| Bridge | `vmbr0` |
| IPv4 | `DHCP` |
| IPv6 | leave blank / SLAAC |

Click **Next**.

### 1h. DNS tab

Leave everything at the defaults. Click **Next**.

### 1i. Confirm tab

Review the summary.

> **Important:** **Uncheck "Start after created"** — you must enable Docker
> features before the first boot or Docker will not work inside the container.

Click **Finish** and wait for the task to complete (the log pane will say
`TASK OK`).

### 1j. Enable Docker-required features (critical — do this before starting)

Docker requires two kernel features to be enabled on the LXC. These are the
same settings used in CT 140 (`arr`), CT 180 (`requestr`), and your other
Docker containers.

1. In the left panel, click **CT 181 (gift-guide)**.
2. Click the **Options** tab.
3. Double-click the **Features** row.
4. In the popup, check both boxes:
   - ✅ **Nesting**
   - ✅ **keyctl**
5. Click **OK**.

Without these two options, Docker will fail to start inside the container
with a confusing permission error.

### 1k. Start the container and open a console

1. With CT 181 selected, click the **Start** button (green triangle, top of page).
2. Click **Console** to open a terminal window into the container.
3. Log in as `root` using the password you set in step 1b.

You are now inside the container. All remaining commands through Step 8 are
run here.

---

## Step 2 — Initial Debian 12 setup

Run these commands one at a time, waiting for each to finish before continuing.

```bash
# Update the package list
apt update
```

```bash
# Upgrade all installed packages to the latest versions
apt upgrade -y
```

This may take a minute. You will see a lot of package names scroll by — that
is normal. Wait for the prompt (`root@gift-guide:~#`) to return.

```bash
# Install the tools needed for the rest of this guide
apt install -y curl git ca-certificates gnupg nano sudo
```

Confirm the hostname is correct:

```bash
hostname
```

Expected output:
```
gift-guide
```

---

## Step 3 — Install Docker Engine

Debian 12 does not include Docker. We add the official Docker apt repository
so we get the current, supported version.

**Copy and paste each block below in order.** Wait for each block to finish
before running the next one.

### 3a. Remove any old unofficial Docker packages

```bash
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
```

This is safe to run even if nothing is installed — errors are suppressed.

### 3b. Add Docker's official GPG signing key

```bash
install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/debian/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

chmod a+r /etc/apt/keyrings/docker.gpg
```

### 3c. Add the Docker stable repository

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 3d. Install Docker Engine and the Compose plugin

```bash
apt-get update

apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin
```

This downloads and installs Docker. It will take a minute or two.

### 3e. Enable and start Docker

```bash
# Start Docker automatically whenever the container boots
systemctl enable docker

# Start Docker right now
systemctl start docker
```

### 3f. Verify Docker is working

```bash
docker run --rm hello-world
```

You should see a message that says:

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

If you see a permission error instead, go back and confirm that **Nesting** and
**keyctl** are both checked in CT 181 Options → Features (step 1j), then reboot
the container (`pct reboot 181` from the Proxmox shell) and try again.

---

## Step 4 — Clone the repository

The app will live in `/opt` — the conventional location for self-hosted software
on Linux.

```bash
cd /opt
git clone https://github.com/mhaegens/gift-guide.git
```

Move into the project directory:

```bash
cd gift-guide
```

Every command from this point on assumes you are inside `/opt/gift-guide`.
If you open a new console session later and need to return here:

```bash
cd /opt/gift-guide
```

---

## Step 5 — Create the environment file

Copy the example file that ships with the repo:

```bash
cp .env.example .env
```

Open it for editing:

```bash
nano .env
```

You need to set three values. The file currently looks like:

```env
NODE_ENV=development
SESSION_SECRET=
ADMIN_INITIAL_PASSWORD=change_me_on_first_login
```

Change it to:

```env
NODE_ENV=production
SESSION_SECRET=<paste the generated value from the command below>
ADMIN_INITIAL_PASSWORD=<choose a strong temporary password>
```

**Generate a secure `SESSION_SECRET`** — open a second console tab, run this,
and copy the output:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

It will print a 64-character hex string. Paste that as the value of
`SESSION_SECRET`.

> **Why SESSION_SECRET matters:** If you leave it blank, the container
> auto-generates a new one on every restart — which logs all users out every
> time the app is restarted. Set it once and it never needs to change.

**How to save and exit nano:**
1. Press `Ctrl + O` (the letter O, not zero) — this writes the file
2. Press `Enter` to confirm the filename
3. Press `Ctrl + X` — this exits nano

Verify the file was saved correctly:

```bash
cat .env
```

You should see all three values filled in. If `SESSION_SECRET` is still blank,
run `nano .env` again and repeat.

> **Never commit `.env` to git.** It is already listed in `.gitignore`.

---

## Step 6 — Create the data directory

The app stores all data in a SQLite database inside a `data/` folder.
This folder needs to exist before starting:

```bash
mkdir -p data
```

The database file (`data/gift-guide.db`) is created automatically on first startup.

---

## Step 7 — Build and start the app

First make sure you have the latest version of the code. If you cloned the
repo more than a few minutes ago, always pull before building:

```bash
git pull
```

Then build and start:

```bash
docker compose up -d --build
```

**What this does:**
- `--build` — builds the Docker image from the Dockerfile in the repo
- `-d` — runs everything in the background (detached mode)

**What happens during the build (it takes a few minutes):**

1. **Stage 1 (deps):** Installs Node.js dependencies and compiles the native
   SQLite C++ addon (`better-sqlite3`). This is the slow part.
2. **Stage 2 (builder):** Compiles the Vue 3 frontend with Vite into an
   optimised production bundle.
3. **Stage 3 (runner):** Creates a minimal final image with only what's needed
   to run the app — no source code, no build tools, no compiler.

> The **first build takes 3–6 minutes** depending on your internet speed and CPU.
> Every subsequent restart (without `--build`) takes under 5 seconds.

You will see a lot of output. It is done when you get your command prompt back.

Check the app started correctly:

```bash
docker compose logs app
```

Look for these lines near the bottom:

```
Database schema initialised at /app/data/gift-guide.db
Admin user "admin" created. Password change required on first login.
Gift Guide listening on port 3000
```

All three lines confirm the app is running, the database is set up, and the
admin account is ready.

---

## Step 8 — Find CT 181's IP address

The Cloudflare Tunnel config on `pve-homelab` needs to know the IP address of
this container. Find it now while you are already logged into the console:

```bash
ip addr show eth0 | grep 'inet '
```

Example output:
```
    inet 192.168.0.XXX/24 brd 192.168.0.255 scope global dynamic eth0
```

The value after `inet` and before the `/24` is the IP address —
for example `192.168.0.XXX`. **Write this down** — you need it in the next step.

> You can also find it in the Proxmox web UI: click CT 181 in the left panel →
> the **Summary** tab shows the IP address at the top.

---

## Step 9 — Add Gift Guide to the homelab Cloudflare Tunnel

These commands are run on **`pve-homelab`**, not inside CT 181.

Open a new terminal and SSH into your Proxmox host (or use the Proxmox web
shell: top menu → **Shell**):

```bash
ssh root@<your-proxmox-ip>
```

### 9a. Edit the tunnel config

```bash
nano /etc/cloudflared/config.yml
```

The file currently looks like this (abbreviated):

```yaml
tunnel: homelab
credentials-file: /root/.cloudflared/554a9a08-9ec8-4b2e-a4da-ae180790cec5.json

ingress:
  - hostname: ha.haegens.be
    service: http://192.168.0.184:8123
  - hostname: jellyfin.haegens.be
    service: http://192.168.0.XXX:8096
  - hostname: requests.haegens.be
    service: http://192.168.0.XXX:3000
  - service: http_status:404
```

Add a new rule for Gift Guide **above the `http_status:404` line** — that line
must always stay last (it is the catch-all for unmatched requests).

Insert this block, replacing `192.168.0.XXX` with the IP you found in Step 8:

```yaml
  - hostname: gifts.haegens.be
    service: http://192.168.0.XXX:3000
```

After editing, the ingress section should look like this:

```yaml
ingress:
  - hostname: ha.haegens.be
    service: http://192.168.0.184:8123
  - hostname: jellyfin.haegens.be
    service: http://192.168.0.XXX:8096
  - hostname: requests.haegens.be
    service: http://192.168.0.XXX:3000
  - hostname: gifts.haegens.be
    service: http://192.168.0.XXX:3000
  - service: http_status:404
```

> **Important:** The last rule (`- service: http_status:404`) must have **no `hostname:` key at all** — not even `hostname:` with an empty value. It is the catch-all that returns 404 for any unmatched hostname. If you accidentally write `hostname:` (empty), cloudflared will reject the config with: `Rule #N is matching the hostname '', but this will match every hostname`.

Save and exit: `Ctrl + O`, Enter, `Ctrl + X`.

### 9b. Create the DNS CNAME record

This command tells Cloudflare to create a CNAME for `gifts.haegens.be`
pointing to your tunnel endpoint — the same way `ha.haegens.be` and the others
were set up:

```bash
cloudflared tunnel route dns homelab gifts.haegens.be
```

Expected output:
```
Added CNAME gifts.haegens.be which will route to this tunnel tunnelID=554a9a08-...
```

### 9c. Restart cloudflared

```bash
systemctl restart cloudflared
```

Confirm it is running and picked up the new config:

```bash
systemctl status cloudflared
```

The output should show `active (running)`. If it shows `failed`, the config
has a YAML syntax error — re-open the file and check indentation (YAML is
very sensitive to spaces).

For detailed logs:

```bash
journalctl -u cloudflared -n 30
```

---

## Step 10 — Verify everything is working

### Check the app is still running (inside CT 181)

```bash
docker compose -f /opt/gift-guide/docker-compose.yml ps
```

The `app` service should show `running`.

### Check the app responds locally

```bash
curl http://localhost:3000/api/auth/me
```

Expected output:
```
{"error":"Please log in"}
```

HTTP 401 is the correct response here — it confirms the server is running and
responding to requests.

### Check the tunnel is routing (on pve-homelab)

```bash
journalctl -u cloudflared -n 10
```

Look for lines mentioning `gifts.haegens.be` or a general
`Connection established` message with no errors.

### Open the app in your browser

Navigate to: **https://gifts.haegens.be**

You should see the Gift Guide login page. Log in with `admin` / the password
you set in Step 5. You will be prompted to change your password on first login.

---

## Step 11 — Using Gift Guide

| URL | Purpose | Who accesses it |
|---|---|---|
| `https://gifts.haegens.be/` | Browse wishlists, add items, claim gifts | All family members |
| `https://gifts.haegens.be/admin` | Admin panel — manage users and accounts | Admin only |

### First login — password change

Log in with `admin` and the temporary password from Step 5. The app immediately
forces a password change. Set a strong permanent password and save it somewhere
safe — there is no password recovery flow.

### Adding family members

Open the Admin panel → create an account for each person. They log in with
their username and the temporary password you give them; they will be prompted
to change it on first login.

### Adding wishlist items

Each person has one persistent wishlist. To add an item:
1. Click **My List** in the bottom navigation.
2. Click **+ Add item**.
3. Optionally paste a product URL — the app auto-fetches the title and image.
4. Set a price range and click **Save**.

### Claiming a gift

Browse to any family member's wishlist (tap their name on the home screen).
Items show as unclaimed or "already taken". Tap **Claim** on the item you want
to buy. The item now shows as taken to everyone else, but the owner never sees
any claim status on their own list.

### The secrecy model

| Who sees what | Claim status | Claimer identity |
|---|---|---|
| **Wishlist owner** | Hidden — they never know if their items are claimed | Hidden |
| **Other members** | Visible (claimed / unclaimed) | Hidden — only "claimed by me" or "someone else" |
| **The claimer** | Sees their own claims in "My Purchases" | Knows it's them |

This is enforced server-side on every API response — it cannot be bypassed.

### My Purchases

The **My Purchases** tab shows all items you have claimed, grouped by person.
Use this as your shopping checklist when you are out buying gifts.

---

## Step 12 — Updating the app

When a new version is available, run this inside CT 181:

```bash
cd /opt/gift-guide
git pull
docker compose up -d --build
```

Docker rebuilds the image and replaces the running container. The `data/`
directory (containing the SQLite database) is mounted as a Docker volume and
is never touched by updates. No data is ever lost.

---

## Step 13 — Backup

Your entire dataset is a single file: `data/gift-guide.db`.

```bash
# Simple file copy — safe to run while the app is running
cp /opt/gift-guide/data/gift-guide.db \
   /opt/gift-guide/data/gift-guide.backup-$(date +%Y%m%d).db
```

For a guaranteed-consistent backup using SQLite's built-in backup command:

```bash
sqlite3 /opt/gift-guide/data/gift-guide.db \
  ".backup /opt/gift-guide/data/gift-guide.backup.db"
```

To run this automatically every night, add a cron job on CT 181:

```bash
crontab -e
```

Add this line:
```
0 3 * * * sqlite3 /opt/gift-guide/data/gift-guide.db ".backup /opt/gift-guide/data/gift-guide.backup-$(date +\%Y\%m\%d).db"
```

---

## Security overview

| Concern | How it's handled |
|---|---|
| Session secret | Stored only in `.env` on CT 181 — fixed value prevents session invalidation on restart |
| Public exposure | Cloudflare Tunnel — **no open inbound ports** on your router |
| LAN exposure | Port 3000 is reachable on the internal LAN (required for the tunnel); not accessible from the internet without going through Cloudflare |
| Passwords | bcrypt cost 12 — never stored plaintext |
| Gift secrecy | Enforced server-side in `serializeItem()` on every API response — cannot be bypassed client-side |
| Admin panel | Requires login as an admin-role account |

> **Optional extra:** Add a Cloudflare Access policy (free tier) on `gifts.haegens.be`
> so only your family's email addresses can reach it. Configure this in the
> Cloudflare Zero Trust dashboard under **Access → Applications**.

---

## Troubleshooting

| Symptom | What to check / fix |
|---|---|
| Docker fails to start inside the LXC | CT 181 → Options → Features — confirm **Nesting** ✅ and **keyctl** ✅ are both checked; reboot with `pct reboot 181` on the Proxmox shell |
| `docker: command not found` | Re-run all commands in Step 3 from the beginning |
| Build fails: `no space left on device` | Run `df -h` inside CT 181 — if `/` is full, expand in Proxmox: CT 181 → Resources → Disk → Resize |
| App container exits immediately | Run `docker compose logs app` inside CT 181 — the error will be there |
| `SESSION_SECRET` is blank | Run `cat /opt/gift-guide/.env` — confirm the value is set; if blank, edit `.env` and restart with `docker compose up -d` |
| Admin login fails | Run `docker compose logs app | grep -i seed` — if the seed step did not run, restart the container (the entrypoint re-runs schema init and seeding automatically, both are idempotent) |
| Sessions lost after restart | `SESSION_SECRET` must be set to a fixed value in `.env` — see Step 5 |
| `gifts.haegens.be` shows a Cloudflare error | Check `systemctl status cloudflared` on `pve-homelab`; confirm the ingress rule is present and the IP is correct |
| cloudflared fails to restart | Check for YAML syntax errors in `/etc/cloudflared/config.yml` — indentation must use spaces, not tabs |
| `Rule #N is matching the hostname '', but this will match every hostname` | The catch-all rule has an accidental empty `hostname:` key. Open `/etc/cloudflared/config.yml` and ensure the last ingress entry is exactly `- service: http_status:404` with **no** `hostname:` line |
| DNS not resolving | Re-run `cloudflared tunnel route dns homelab gifts.haegens.be` on `pve-homelab` |
| Page loads but shows connection error | The IP in the cloudflared config may be wrong — re-check Step 8 and update `/etc/cloudflared/config.yml` |
| `permission denied` on `data/` | Run `chown -R 1001:1001 /opt/gift-guide/data/` inside CT 181 |

---

## Appendix — Local development (no Docker)

To run the app on your laptop for development:

```bash
# Requires Node.js 20 or newer — check with: node --version
npm install
cp .env.example .env.local
# Edit .env.local: set ADMIN_INITIAL_PASSWORD (SESSION_SECRET is optional for dev)
npm run setup      # create tables + seed admin user
npm run dev:all    # start backend (port 3000) + Vite frontend (port 5173) together
```

Open <http://localhost:3000> in your browser. File changes reload automatically.
The Cloudflare Tunnel is not used in local development.
