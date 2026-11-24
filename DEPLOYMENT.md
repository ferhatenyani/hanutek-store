# Deploying hanutek on a VPS (Ubuntu + PostgreSQL)

This guide sets up a single Ubuntu 24.04 server: PostgreSQL, the Next.js app run by systemd, and nginx with free HTTPS (Let's Encrypt). Product images are stored on the server's disk.

Replace `hanutek.dz` with your domain everywhere.

**Server:** 2 GB RAM minimum (the build needs it), 1–2 vCPU, 20 GB+ disk. An EU location such as Hetzner, OVH or Contabo is closest to Algeria.

---

## 0. Before you start

- **DNS:** create `A` records for `hanutek.dz` and `www.hanutek.dz` pointing to the server's IP.
- **Code:** push the project to a private Git repository (GitHub or GitLab) so the server can `git clone` it.
- **Resend account** (for verification and password-reset emails):
  1. Sign up at resend.com.
  2. Under Domains, add `hanutek.dz` and copy the DNS records it gives you into your DNS provider. Wait until Resend shows "Verified".
  3. Under API Keys, create a key and keep it for step 4.
- **Google sign-in** (optional; the button stays hidden without it):
  1. Google Cloud Console → APIs & Services → OAuth consent screen: fill it in, External, publish.
  2. Credentials → Create OAuth client ID → Web application.
  3. Authorized redirect URI: `https://hanutek.dz/api/v1/auth/google/callback`
  4. Keep the Client ID and Client secret for step 4.

---

## 1. Server basics

SSH in as root, then:

```bash
apt update && apt upgrade -y
apt install -y git nginx ufw curl

# firewall: SSH + web only (PostgreSQL stays private)
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# dedicated user that runs the app
adduser --system --group --home /srv/hanutek hanutek
```

If the server has only 2 GB of RAM, add swap so the build doesn't run out of memory:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Node.js 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
node -v   # v24.x
```

## 3. PostgreSQL

```bash
apt install -y postgresql

# generate a password (hex = no characters that need escaping in the URL)
openssl rand -hex 24          # copy the output; this is DB_PASSWORD below

sudo -u postgres psql <<'SQL'
CREATE USER hanutek WITH PASSWORD 'PASTE_DB_PASSWORD_HERE';
CREATE DATABASE hanutek OWNER hanutek;
SQL
```

PostgreSQL only listens on localhost by default, which is what we want.

## 4. Get the app and configure it

```bash
sudo -u hanutek git clone https://github.com/YOU/hanutek-hermess.git /srv/hanutek/app
mkdir -p /srv/hanutek/uploads && chown hanutek:hanutek /srv/hanutek/uploads

# generate the token signing secret
openssl rand -base64 48       # copy the output; this is JWT_SECRET below

sudo -u hanutek nano /srv/hanutek/app/.env
```

Paste this into `.env` and fill in the values:

```bash
NODE_ENV=production
APP_URL=https://hanutek.dz

DATABASE_URL=postgres://hanutek:PASTE_DB_PASSWORD_HERE@127.0.0.1:5432/hanutek
JWT_SECRET=PASTE_JWT_SECRET_HERE

# nginx sits in front of the app: required so rate limits see each visitor's real IP
TRUST_PROXY_HOPS=1

# images stored on this server, served by nginx
STORAGE_DRIVER=local
UPLOAD_DIR=/srv/hanutek/uploads

# e-mails (verification, password reset)
MAIL_DRIVER=resend
RESEND_API_KEY=PASTE_RESEND_KEY_HERE
MAIL_FROM="hanutek <no-reply@hanutek.dz>"

# Google sign-in (leave empty to disable)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# first admin account (created by the seed; remove these two lines afterwards)
SEED_ADMIN_EMAIL=you@hanutek.dz
SEED_ADMIN_PASSWORD=PICK_A_STRONG_PASSWORD

LOG_LEVEL=info
```

Then lock the file down:

```bash
chmod 600 /srv/hanutek/app/.env
```

## 5. Install, create the database, build

```bash
cd /srv/hanutek/app
sudo -u hanutek npm ci
sudo -u hanutek npm run db:migrate     # creates the tables
sudo -u hanutek npm run db:seed        # catalogue, DRIVE10 promo, your admin account
sudo -u hanutek npm run build          # needs the database: catalogue pages are pre-built from it
```

Now remove `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env`.

## 6. Run the app as a service

```bash
cat > /etc/systemd/system/hanutek.service <<'EOF'
[Unit]
Description=hanutek storefront
After=network.target postgresql.service

[Service]
User=hanutek
WorkingDirectory=/srv/hanutek/app
EnvironmentFile=/srv/hanutek/app/.env
ExecStart=/usr/bin/npm start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now hanutek
systemctl status hanutek          # should say "active (running)"
curl http://127.0.0.1:3000/api/v1/health   # {"status":"ok"}
```

The app listens only on `127.0.0.1`. The public reaches it through nginx.

## 7. nginx + HTTPS

```bash
cat > /etc/nginx/sites-available/hanutek <<'EOF'
server {
    listen 80;
    server_name hanutek.dz www.hanutek.dz;

    client_max_body_size 12m;   # product image uploads (10 MB max)

    # uploaded product images, served straight from disk
    location /uploads/ {
        alias /srv/hanutek/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
        try_files $uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -s /etc/nginx/sites-available/hanutek /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# free HTTPS certificate (auto-renews)
apt install -y certbot python3-certbot-nginx
certbot --nginx -d hanutek.dz -d www.hanutek.dz --redirect
```

`X-Forwarded-For $remote_addr` (not `$proxy_add_x_forwarded_for`) means a visitor can't fake their IP. This matches `TRUST_PROXY_HOPS=1`.

Open https://hanutek.dz. The site should load, and you can sign in with your admin account.

## 8. Daily database backups

```bash
mkdir -p /var/backups/hanutek && chown postgres:postgres /var/backups/hanutek
cat > /etc/cron.d/hanutek-backup <<'EOF'
# 03:00 every day: dump the database, keep 14 days
0 3 * * * postgres pg_dump -Fc hanutek > /var/backups/hanutek/hanutek-$(date +\%F).dump && find /var/backups/hanutek -name '*.dump' -mtime +14 -delete
EOF
```

Also copy `/var/backups/hanutek` and `/srv/hanutek/uploads` off the server regularly (for example with rsync, or your host's snapshot feature). A backup that stays on the same machine won't survive that machine failing.

Restore if needed: `sudo -u postgres pg_restore --clean -d hanutek /var/backups/hanutek/hanutek-YYYY-MM-DD.dump`

---

## Updating the site later

```bash
cd /srv/hanutek/app
sudo -u hanutek git pull
sudo -u hanutek npm ci
sudo -u hanutek npm run db:migrate     # safe to run every time; applies only new migrations
sudo -u hanutek npm run build
systemctl restart hanutek
```

---

## Quick checks if something's wrong

| Symptom | Check |
|---|---|
| Site down / 502 | `systemctl status hanutek` and `journalctl -u hanutek -n 100` |
| App won't start: "Invalid server environment" | a value in `.env` is missing or invalid; the message names it |
| Emails not arriving | the Resend dashboard shows each send; the domain must show "Verified" |
| Google login fails | the redirect URI in Google Console must match `https://hanutek.dz/api/v1/auth/google/callback` exactly |
| Uploaded images 404 | `UPLOAD_DIR` in `.env` and `alias` in nginx must be the same folder |

## Checklist

- [ ] DNS A records point to the server
- [ ] `.env` filled in, `chmod 600`, seed admin lines removed after seeding
- [ ] `curl https://hanutek.dz/api/v1/health` returns `{"status":"ok"}`
- [ ] HTTPS works and http redirects to https
- [ ] Registration email arrives (Resend)
- [ ] Test order placed and visible in your account
- [ ] Backups cron in place and copied off-server
- [ ] Never set `LOCAL_PREVIEW` on the server
