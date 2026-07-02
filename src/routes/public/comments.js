/**
 * Public comments API
 *
 * GET  /api/comments?type=&id=&limit=&offset=  -> list visible comments + section settings
 * POST /api/comments  { type, id, name, body }  -> create a comment (settings + banned-word enforced)
 */
import { Hono } from 'hono';
import { optionalUserAuth } from '../../middleware/userAuth.js';

const publicComments = new Hono();

const ALLOWED_TYPES = ['album', 'video', 'photo', 'blog'];
const DEFAULT_SETTINGS = { post_mode: 'open', is_visible: 1 };
const MAX_NAME = 60;
const MAX_BODY = 2000;
const MAX_LIMIT = 50;

async function getSettings(env, section) {
    try {
        const row = await env.DB.prepare(
            'SELECT post_mode, is_visible FROM comment_settings WHERE section = ?'
        ).bind(section).first();
        return row || DEFAULT_SETTINGS;
    } catch (e) {
        // migration not yet applied — fall back to permissive defaults
        return DEFAULT_SETTINGS;
    }
}

function settingsPayload(s) {
    return { postMode: s.post_mode, isVisible: !!s.is_visible };
}

// Optional auth so we can attribute logged-in users and tailor the form
publicComments.use('*', optionalUserAuth);

// List comments for a piece of content
publicComments.get('/', async (c) => {
    const type = c.req.query('type');
    const id = parseInt(c.req.query('id'), 10);
    if (!ALLOWED_TYPES.includes(type) || !Number.isInteger(id)) {
        return c.json({ error: 'Invalid type or id' }, 400);
    }

    const user = c.get('user');
    const settings = await getSettings(c.env, type);

    // Hidden section — return nothing to render
    if (!settings.is_visible) {
        return c.json({ comments: [], total: 0, settings: settingsPayload(settings), loggedIn: !!user });
    }

    const limit = Math.min(parseInt(c.req.query('limit') || '10', 10) || 10, MAX_LIMIT);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

    const result = await c.env.DB.prepare(
        `SELECT id, author_name, body, created_at
         FROM comments
         WHERE content_type = ? AND content_id = ? AND status = 'visible'
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`
    ).bind(type, id, limit, offset).all();

    const countRow = await c.env.DB.prepare(
        `SELECT COUNT(*) as total FROM comments
         WHERE content_type = ? AND content_id = ? AND status = 'visible'`
    ).bind(type, id).first();

    return c.json({
        comments: result.results,
        total: countRow ? countRow.total : 0,
        settings: settingsPayload(settings),
        loggedIn: !!user,
    });
});

// Create a comment
publicComments.post('/', async (c) => {
    let body;
    try {
        body = await c.req.json();
    } catch (e) {
        return c.json({ error: 'Invalid JSON' }, 400);
    }

    const type = body.type;
    const id = parseInt(body.id, 10);
    if (!ALLOWED_TYPES.includes(type) || !Number.isInteger(id)) {
        return c.json({ error: 'Invalid type or id' }, 400);
    }

    const user = c.get('user');
    const settings = await getSettings(c.env, type);

    // Enforce section settings server-side (source of truth)
    if (!settings.is_visible || settings.post_mode === 'closed') {
        return c.json({ error: 'Comments are closed for this section' }, 403);
    }
    if (settings.post_mode === 'logged_in' && !user) {
        return c.json({ error: 'You must be signed in to comment' }, 401);
    }

    // Name: forced to account name when logged in, otherwise required from the form
    let authorName = user ? user.name : String(body.name || '').trim();
    if (!authorName) {
        return c.json({ error: 'A name is required' }, 400);
    }
    authorName = authorName.slice(0, MAX_NAME);

    const text = String(body.body || '').trim();
    if (!text) {
        return c.json({ error: 'Comment cannot be empty' }, 400);
    }
    if (text.length > MAX_BODY) {
        return c.json({ error: 'Comment is too long' }, 400);
    }

    // Banned-phrase check (case-insensitive substring)
    try {
        const banned = await c.env.DB.prepare('SELECT phrase FROM banned_phrases').all();
        const lower = text.toLowerCase();
        const lowerName = authorName.toLowerCase();
        const hit = banned.results.some(b => b.phrase && (lower.includes(b.phrase) || lowerName.includes(b.phrase)));
        if (hit) {
            return c.json({ error: "Your comment couldn't be posted." }, 422);
        }
    } catch (e) { /* table missing — skip filtering */ }

    const insert = await c.env.DB.prepare(
        `INSERT INTO comments (content_type, content_id, author_name, body, user_id, status)
         VALUES (?, ?, ?, ?, ?, 'visible')`
    ).bind(type, id, authorName, text, user ? user.id : null).run();

    const created = await c.env.DB.prepare(
        'SELECT id, author_name, body, created_at FROM comments WHERE id = ?'
    ).bind(insert.meta.last_row_id).first();

    return c.json({ success: true, comment: created }, 201);
});

export default publicComments;
