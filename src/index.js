/**
 * Abacus — Single Hono.js Worker serving API + static assets
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { csrf } from 'hono/csrf';
import authRoutes from './routes/auth.js';
import visitRoutes from './routes/visits.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';
import fileRoutes from './routes/files.js';
import webhookRoutes from './routes/webhook.js';
import sheetMusicCms from './routes/cms/sheet-music.js';
import musicCms from './routes/cms/music.js';
import blogCms from './routes/cms/blog.js';
import videosCms from './routes/cms/videos.js';
import photosCms from './routes/cms/photos.js';
import publicSheetMusic from './routes/public/sheet-music.js';
import publicMusic from './routes/public/music.js';
import publicBlog from './routes/public/blog.js';
import publicVideos from './routes/public/videos.js';
import publicPhotos from './routes/public/photos.js';
import { adminAuth } from './middleware/auth.js';

const api = new Hono();

// ------------------------------------
// Global middleware
// ------------------------------------
api.use('*', secureHeaders());

api.use('/api/*', cors({
    origin: (origin, c) => {
        // In development allow same-origin (origin will be null or localhost)
        if (!origin) return '*';
        if (c.env.ENVIRONMENT === 'development') return origin;
        // In production, restrict to your actual domain
        const allowed = c.env.ALLOWED_ORIGIN || '*';
        return origin === allowed ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
}));

// CSRF protection on mutation routes (skip for API visit logging from frontend)
api.use('/api/user/*', csrf());
api.use('/api/admin/*', csrf());

// Body size limit (1MB, skip for file uploads)
api.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/admin/upload')) return next();
    const contentLength = c.req.header('Content-Length');
    if (contentLength && parseInt(contentLength) > 1_048_576) {
        return c.json({ error: 'Request too large' }, 413);
    }
    await next();
});

// ------------------------------------
// Rate limiting (per-isolate, simple Map)
// ------------------------------------
const rateLimits = new Map();

function rateLimit(key, maxRequests, windowMs) {
    const now = Date.now();
    const entry = rateLimits.get(key);

    if (!entry || now - entry.start > windowMs) {
        rateLimits.set(key, { start: now, count: 1 });
        return false; // not limited
    }

    entry.count++;
    if (entry.count > maxRequests) {
        return true; // limited
    }
    return false;
}

// Clean up stale entries periodically (every 100 requests)
let requestCount = 0;
function cleanupRateLimits() {
    requestCount++;
    if (requestCount % 100 === 0) {
        const now = Date.now();
        for (const [key, entry] of rateLimits) {
            if (now - entry.start > 120_000) rateLimits.delete(key);
        }
    }
}

// Rate limit login and register endpoints
api.use('/api/user/login', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    cleanupRateLimits();
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    if (rateLimit(`login:${ip}`, 5, 60_000)) {
        return c.json({ error: 'Too many login attempts. Try again in a minute.' }, 429);
    }
    await next();
});

api.use('/api/user/register', async (c, next) => {
    if (c.req.method !== 'POST') return next();
    cleanupRateLimits();
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    if (rateLimit(`register:${ip}`, 5, 60_000)) {
        return c.json({ error: 'Too many registration attempts. Try again in a minute.' }, 429);
    }
    await next();
});

// ------------------------------------
// Mount routes
// ------------------------------------
api.route('/api/user', authRoutes);
api.route('/api/visit', visitRoutes);
api.route('/api/admin', adminRoutes);

// CMS admin routes
api.route('/api/admin/upload', uploadRoutes);
api.route('/api/admin/sheet-music', sheetMusicCms);
api.route('/api/admin/music', musicCms);
api.route('/api/admin/blog', blogCms);
api.route('/api/admin/videos', videosCms);
api.route('/api/admin/photos', photosCms);

// Public content APIs
api.route('/api/sheet-music', publicSheetMusic);
api.route('/api/music', publicMusic);
api.route('/api/blog', publicBlog);
api.route('/api/videos', publicVideos);
api.route('/api/photos', publicPhotos);

// File serving (public)
api.route('/api/files', fileRoutes);

// Stripe webhook (no auth, no CSRF — verified by signature)
api.route('/api/webhook', webhookRoutes);

// GET /api/visits — admin-protected visit history (backward compat)
api.get('/api/visits', adminAuth, async (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await c.env.DB.prepare(`
        SELECT v.*, u.name as user_name
        FROM visits v
        LEFT JOIN users u ON v.user_id = u.id
        ORDER BY v.visited_at DESC
        LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await c.env.DB.prepare(
        'SELECT COUNT(*) as total FROM visits'
    ).first();

    return c.json({
        visits: result.results,
        total: countResult.total,
        limit,
        offset,
    });
});

// GET /api/users — admin-protected user list (backward compat)
api.get('/api/users', adminAuth, async (c) => {
    const users = await c.env.DB.prepare(`
        SELECT id, name, is_admin, created_at, last_seen,
            password_hash IS NOT NULL as has_password
        FROM users
        ORDER BY last_seen DESC
    `).all();

    return c.json({ users: users.results });
});

// Health check
api.get('/api/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 for unknown API routes
api.all('/api/*', (c) => {
    return c.json({ error: 'Not found' }, 404);
});

// ------------------------------------
// Export: API routes + static asset fallthrough
// ------------------------------------
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Route /api/* to the Hono app
        if (url.pathname.startsWith('/api')) {
            return api.fetch(request, env, ctx);
        }

        // Everything else: serve static assets from public/
        return env.ASSETS.fetch(request);
    },
};
