# Abacus API

Cloudflare Workers API with D1 database for user tracking and authentication.

## Quick Start

```bash
# Install dependencies
npm install

# Initialize local database
npm run db:init

# Start local development server
npm run dev
```

The API will be available at `http://localhost:8787`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/visit` | Log a visitor |
| GET | `/api/user/check/:name` | Check if user exists |
| POST | `/api/user/register` | Register new user |
| POST | `/api/user/login` | Authenticate user |
| GET | `/api/visits` | Get all visits (admin) |
| GET | `/api/users` | Get all users (admin) |
| GET | `/api/health` | Health check |

## Database Commands

```bash
# Initialize local database
npm run db:init

# View database contents
npm run db:studio

# Initialize remote database (after setting up Cloudflare)
npm run db:init:remote
```

## Deployment to Cloudflare

1. Create a Cloudflare account at https://dash.cloudflare.com
2. Install Wrangler CLI: `npm install -g wrangler`
3. Login to Cloudflare: `wrangler login`
4. Create the D1 database:
   ```bash
   wrangler d1 create abacus-db
   ```
5. Update `wrangler.toml` with the real database ID
6. Initialize remote database: `npm run db:init:remote`
7. Deploy: `npm run deploy`

## Environment Variables

Update `wrangler.toml` for production:
- Change `ENVIRONMENT` to `"production"`
- Update `database_id` with real D1 database ID

## Local Development

The local dev server uses a SQLite file stored in `.wrangler/state/v3/d1/`.
This mimics D1's behavior exactly.
