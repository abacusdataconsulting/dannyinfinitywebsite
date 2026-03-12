# Abacus Deployment Guide

## Architecture Overview

```
Cloudflare Workers (Hono.js)
├── Static Assets (public/)    ── Workers Static Assets
├── API Routes (src/)          ── Cloudflare Workers
├── Database                   ── Cloudflare D1 (SQLite)
├── File Storage               ── Cloudflare R2
└── Payments (future)          ── Stripe
```

Everything runs on Cloudflare's edge. No external servers needed.

---

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free plan works for initial deployment)
- [Node.js](https://nodejs.org/) 18+
- Wrangler CLI installed (`npm install -g wrangler` or use the project's local copy)
- Domain name (optional, Cloudflare provides a `*.workers.dev` subdomain)

---

## Phase 1: Cloudflare Account Setup

### 1. Authenticate Wrangler

```bash
npx wrangler login
```

This opens a browser to authorize Wrangler with your Cloudflare account.

### 2. Create the D1 Database

```bash
npx wrangler d1 create abacus-db
```

This outputs something like:

```
✅ Successfully created DB 'abacus-db'

[[d1_databases]]
binding = "DB"
database_name = "abacus-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id`** — you need it in the next step.

### 3. Create the R2 Bucket

```bash
npx wrangler r2 bucket create abacus-files
```

---

## Phase 2: Update wrangler.toml

Replace the placeholder `database_id` and configure production settings:

```toml
name = "abacus"
main = "src/index.js"
compatibility_date = "2024-12-01"

[assets]
directory = "./public"
binding = "ASSETS"

[vars]
ENVIRONMENT = "production"
ALLOWED_ORIGIN = "https://yourdomain.com"  # or "https://abacus.yourname.workers.dev"
R2_PUBLIC_URL = ""  # Set to "https://files.yourdomain.com" to serve media directly from R2

[[d1_databases]]
binding = "DB"
database_name = "abacus-db"
database_id = "PASTE-YOUR-REAL-DATABASE-ID-HERE"

[[r2_buckets]]
binding = "R2"
bucket_name = "abacus-files"
```

### What changed:
| Setting | Before | After |
|---------|--------|-------|
| `ENVIRONMENT` | `"development"` | `"production"` |
| `ALLOWED_ORIGIN` | not set | your production domain |
| `database_id` | `"local-dev-db"` | real ID from `wrangler d1 create` |

---

## Phase 3: Initialize the Production Database

Run these commands **in order** to set up the remote D1 database:

```bash
# 1. Create core tables (users, visits, sessions)
npx wrangler d1 execute abacus-db --remote --file=schema.sql

# 2. Add PBKDF2 password columns
npx wrangler d1 execute abacus-db --remote --file=migrations/002-add-pbkdf2.sql

# 3. Create CMS tables (sheet_music, albums, tracks, videos, blog_posts, photos, donations)
npx wrangler d1 execute abacus-db --remote --file=migrations/003-cms-tables.sql
```

### Seed data (optional)

Only run these if you want the starter content:

```bash
npx wrangler d1 execute abacus-db --remote --file=migrations/004-seed-sheet-music.sql
npx wrangler d1 execute abacus-db --remote --file=migrations/005-seed-music.sql
npx wrangler d1 execute abacus-db --remote --file=migrations/006-seed-blog-videos-photos.sql
```

### Create the admin user

You need to create an admin user directly in the production database. Generate a password hash first, then insert:

```bash
npx wrangler d1 execute abacus-db --remote --command "INSERT INTO users (name, password_hash, password_salt, password_version, is_admin) VALUES ('admin', 'YOUR_HASH', 'YOUR_SALT', 2, 1);"
```

**Alternatively**, after deployment you can register through the site as a normal user, then promote yourself:

```bash
npx wrangler d1 execute abacus-db --remote --command "UPDATE users SET is_admin = 1 WHERE name = 'YourName';"
```

---

## Phase 4: Set Secrets

Secrets are encrypted environment variables that never appear in `wrangler.toml`:

```bash
# Stripe webhook secret (can be a placeholder for now, update when adding payments)
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# When prompted, paste your Stripe webhook signing secret (whsec_...)
```

---

## Phase 5: Deploy

```bash
npm run deploy
```

Or equivalently:

```bash
npx wrangler deploy
```

Your site is now live at: `https://abacus.<your-subdomain>.workers.dev`

### Verify the deployment

```bash
# Health check
curl https://abacus.<your-subdomain>.workers.dev/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

---

## Phase 6: Custom Domain (Optional)

### Option A: Workers Route (domain on Cloudflare)

1. Go to **Cloudflare Dashboard > your domain > Workers Routes**
2. Add route: `yourdomain.com/*` → `abacus` worker

### Option B: Custom Domain on the Worker

1. Go to **Workers & Pages > abacus > Settings > Domains & Routes**
2. Click **Add > Custom Domain**
3. Enter your domain (must be on Cloudflare DNS)

After setting the custom domain, update `ALLOWED_ORIGIN` in `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGIN = "https://yourdomain.com"
```

Then redeploy: `npm run deploy`

---

## Things That Need Attention

### Must Fix Before Deploy

1. **`database_id` in wrangler.toml** — Currently `"local-dev-db"`, must be replaced with the real ID from `wrangler d1 create`.

2. **`ENVIRONMENT` variable** — Currently `"development"`. Change to `"production"` so CORS locks down to your domain instead of allowing all origins.

3. **`ALLOWED_ORIGIN`** — Not currently set. In production, the CORS middleware falls back to `"*"` (allow all) if this isn't set. Set it to your actual domain.

### Should Fix

4. **CSRF middleware may block legitimate requests** — The CSRF middleware on `/api/user/*` and `/api/admin/*` requires a CSRF token header. Verify your frontend JS sends the correct CSRF token header on POST/PUT/DELETE requests, or requests will fail in production. Hono's CSRF middleware by default checks the `Origin` header against the request URL — this should work if `ALLOWED_ORIGIN` is set correctly.

5. **Rate limiting is per-isolate** — The in-memory `Map` for rate limiting resets when Workers cold-starts or when requests hit a different isolate. This is fine for basic protection but not bulletproof. Acceptable for now; can upgrade to Cloudflare Rate Limiting rules later.

6. **Admin credentials** — The README mentions `admin` / `admin123`. Change this immediately in production.

### Nice to Have (Post-Launch)

7. **Session cleanup** — Expired sessions accumulate in the `sessions` table. Consider adding a Cloudflare Cron Trigger to clean them up periodically.

8. **R2 direct file serving** — See [Media Delivery & R2 Public Access](#media-delivery--r2-public-access) below.

---

## Media Delivery & R2 Public Access

### How media files are served

Media files (audio, video, images, PDFs) are stored in Cloudflare R2 and served to visitors through the Worker at `/api/files/:folder/:filename`.

**Edge caching is built in.** The Worker uses the Cloudflare Cache API to cache full-file responses at the edge. The first request for a file goes through the Worker and fetches from R2; all subsequent requests are served directly from the CDN edge with zero Worker execution. Cached files use a 1-year immutable cache policy (safe because filenames are timestamped).

This works well for most use cases. However, for **large video files** or **high-traffic media**, you can eliminate the Worker proxy entirely by enabling R2 public access.

### Enabling R2 Public Access (recommended for video-heavy sites)

This serves files directly from R2 via a custom subdomain, bypassing the Worker completely.

#### 1. Add a subdomain for files

Go to **Cloudflare Dashboard > your domain > DNS** and add a CNAME record:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `files` | `<your-account-id>.r2.cloudflarestorage.com` | Proxied |

#### 2. Connect the domain to R2

Go to **Cloudflare Dashboard > R2 > abacus-files > Settings > Public access > Custom Domains** and add:

```
files.yourdomain.com
```

#### 3. Set the env var

Update `wrangler.toml`:

```toml
[vars]
R2_PUBLIC_URL = "https://files.yourdomain.com"
```

#### 4. Redeploy

```bash
npm run deploy
```

All media URLs returned by the API will now point to `https://files.yourdomain.com/...` instead of `/api/files/...`. No frontend changes needed — the public API routes build URLs dynamically using the `R2_PUBLIC_URL` env var.

#### How it works

- When `R2_PUBLIC_URL` is empty (default): files are served through the Worker with edge caching
- When `R2_PUBLIC_URL` is set: all public API responses return direct R2 URLs, the Worker file route is bypassed entirely
- The Worker file route (`/api/files/...`) still works as a fallback and for admin use

### Upload progress

The admin dashboard shows real-time upload progress (percentage) on the save button when uploading files. Large video uploads (up to 500MB) will display progress like "Uploading video... 73%".

---

## Phase 7: Stripe Payments (After Site is Deployed)

This is your post-launch phase. Steps when ready:

### 1. Stripe Account Setup
- Create/verify your [Stripe account](https://dashboard.stripe.com/)
- Get your API keys from **Developers > API Keys**

### 2. Create a Webhook Endpoint
- Go to **Stripe Dashboard > Developers > Webhooks**
- Add endpoint: `https://yourdomain.com/api/webhook/stripe`
- Select event: `checkout.session.completed`
- Copy the **Signing Secret** (`whsec_...`)

### 3. Set the Real Webhook Secret

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste the whsec_... value
```

### 4. Create Stripe Checkout Sessions

You'll need to add a route or frontend integration to create Stripe Checkout sessions. This requires `STRIPE_SECRET_KEY`:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
# Paste your sk_live_... or sk_test_... key
```

Then add a new API route to create checkout sessions (e.g., `POST /api/checkout`). The webhook handler at `/api/webhook/stripe` is already built and will record donations to D1 when payments complete.

### 5. Redeploy

```bash
npm run deploy
```

---

## Useful Commands Reference

| Command | Description |
|---------|-------------|
| `npx wrangler dev` | Run locally with D1/R2 emulation |
| `npx wrangler deploy` | Deploy to production |
| `npx wrangler d1 execute abacus-db --remote --command "SQL"` | Run SQL on production D1 |
| `npx wrangler d1 execute abacus-db --remote --file=file.sql` | Run SQL file on production D1 |
| `npx wrangler secret put KEY_NAME` | Set an encrypted secret |
| `npx wrangler secret list` | List configured secrets |
| `npx wrangler tail` | Stream live logs from production |
| `npx wrangler r2 object put abacus-files/path -- --file=local.jpg` | Upload file to R2 |
| `npx wrangler d1 info abacus-db` | Show D1 database info |

---

## Deployment Checklist

```
[ ] wrangler login
[ ] wrangler d1 create abacus-db
[ ] wrangler r2 bucket create abacus-files
[ ] Update database_id in wrangler.toml
[ ] Set ENVIRONMENT = "production" in wrangler.toml
[ ] Set ALLOWED_ORIGIN in wrangler.toml
[ ] Run schema.sql on remote D1
[ ] Run migration 002 on remote D1
[ ] Run migration 003 on remote D1
[ ] (Optional) Run seed migrations on remote D1
[ ] Create admin user in production D1
[ ] Set STRIPE_WEBHOOK_SECRET secret (placeholder OK for now)
[ ] npm run deploy
[ ] Verify /api/health returns OK
[ ] Test login flow on production URL
[ ] Test admin dashboard access
[ ] (Optional) Set up custom domain
[ ] (Optional) Set up R2 public access for faster media delivery (see Media Delivery section)
[ ] Change default admin password
```
