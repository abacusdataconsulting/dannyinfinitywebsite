# Abacus — Danny Infinity

Single Cloudflare Worker (Hono.js) serving the full site: static pages, API, CMS admin, and Stripe webhook.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
# Install dependencies
npm install

# Initialize the database schema
npm run db:init

# Run CMS migrations
npm run db:migrate:cms

# Seed content data
npm run db:seed:sheets
npm run db:seed:music
npm run db:seed:content

# Create an admin user
npm run create-admin
# Follow the prompts to set a name and password
```

## Development

```bash
npm run dev
```

Opens at **http://localhost:8787**

The admin dashboard is at `/admin.html` (not linked in site navigation — access by direct URL).

## Environment Variables

Local secrets go in `.dev.vars`:

```
ENVIRONMENT=development
STRIPE_WEBHOOK_SECRET=whsec_your_key_here
```

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run db:init` | Initialize base schema (local) |
| `npm run db:init:remote` | Initialize base schema (remote) |
| `npm run db:migrate:cms` | Run CMS tables migration (local) |
| `npm run db:migrate:cms:remote` | Run CMS tables migration (remote) |
| `npm run db:seed:sheets` | Seed sheet music data (local) |
| `npm run db:seed:music` | Seed albums + tracks data (local) |
| `npm run db:seed:content` | Seed blog, videos, photos data (local) |
| `npm run create-admin` | Create an admin user via CLI |

## Project Structure

```
src/
  index.js              # Main entry — Hono app + middleware + route mounts
  middleware/auth.js     # Admin auth middleware (Bearer token)
  lib/crypto.js          # PBKDF2 hashing, token generation
  routes/
    auth.js              # User check/register/login
    visits.js            # Visit logging
    admin.js             # Admin stats, visits, users, donations
    upload.js            # R2 file upload (admin)
    files.js             # R2 file serving (public)
    webhook.js           # Stripe webhook handler
    cms/                 # Admin CRUD routes
      sheet-music.js
      music.js
      blog.js
      videos.js
      photos.js
    public/              # Public read-only APIs
      sheet-music.js
      music.js
      blog.js
      videos.js
      photos.js
public/                  # Static assets (served by Workers Static Assets)
  *.html
  js/
  css/
  assets/
migrations/
  003-cms-tables.sql
  004-seed-sheet-music.sql
  005-seed-music.sql
  006-seed-blog-videos-photos.sql
schema.sql               # Base database schema
wrangler.toml            # Cloudflare Workers config
```

## Deployment

```bash
# Create D1 database and R2 bucket (first time only)
wrangler d1 create abacus-db
wrangler r2 bucket create abacus-files

# Update wrangler.toml with the real database_id from the command above

# Run migrations on remote
npm run db:init:remote
npm run db:migrate:cms:remote

# Set production secrets
wrangler secret put STRIPE_WEBHOOK_SECRET

# Deploy
npm run deploy
```
