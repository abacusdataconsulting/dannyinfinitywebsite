/**
 * Comments admin routes — moderation, banned phrases, and per-section settings.
 * All routes are admin-protected (adminAuth) and CSRF-protected via /api/admin/* middleware.
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const comments = new Hono();
comments.use('*', adminAuth);

const ALLOWED_TYPES = ['album', 'video', 'photo', 'blog'];
const POST_MODES = ['open', 'logged_in', 'closed'];

// ---------------------------------------------------------------------------
// Per-section settings  ->  /api/admin/comments/settings
// ---------------------------------------------------------------------------
comments.get('/settings', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT section, post_mode, is_visible FROM comment_settings'
    ).all();
    return c.json({ settings: result.results });
});

comments.put('/settings', async (c) => {
    const body = await c.req.json();
    const section = body.section;
    const postMode = body.post_mode;
    const isVisible = body.is_visible ? 1 : 0;

    if (!POST_MODES.includes(postMode)) {
        return c.json({ error: 'Invalid post_mode' }, 400);
    }

    const targets = section === 'all' ? ALLOWED_TYPES : [section];
    if (section !== 'all' && !ALLOWED_TYPES.includes(section)) {
        return c.json({ error: 'Invalid section' }, 400);
    }

    for (const t of targets) {
        await c.env.DB.prepare(
            `INSERT INTO comment_settings (section, post_mode, is_visible) VALUES (?, ?, ?)
             ON CONFLICT(section) DO UPDATE SET post_mode = excluded.post_mode, is_visible = excluded.is_visible`
        ).bind(t, postMode, isVisible).run();
    }

    return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Banned phrases  ->  /api/admin/comments/banned
// ---------------------------------------------------------------------------
comments.get('/banned', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, phrase, created_at FROM banned_phrases ORDER BY phrase ASC'
    ).all();
    return c.json({ phrases: result.results });
});

comments.post('/banned', async (c) => {
    const body = await c.req.json();
    const phrase = String(body.phrase || '').trim().toLowerCase();
    if (!phrase) return c.json({ error: 'Phrase is required' }, 400);
    if (phrase.length > 100) return c.json({ error: 'Phrase is too long' }, 400);

    await c.env.DB.prepare(
        'INSERT OR IGNORE INTO banned_phrases (phrase) VALUES (?)'
    ).bind(phrase).run();

    return c.json({ success: true });
});

comments.delete('/banned/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM banned_phrases WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Moderation list + delete  ->  /api/admin/comments
// ---------------------------------------------------------------------------
comments.get('/', async (c) => {
    const type = c.req.query('type');
    const status = c.req.query('status');
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10) || 100, 200);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

    const filters = [];
    const binds = [];
    if (ALLOWED_TYPES.includes(type)) { filters.push('content_type = ?'); binds.push(type); }
    if (status === 'visible' || status === 'hidden') { filters.push('status = ?'); binds.push(status); }
    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

    const result = await c.env.DB.prepare(
        `SELECT id, content_type, content_id, author_name, body, user_id, status, created_at
         FROM comments ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();

    const countRow = await c.env.DB.prepare(
        `SELECT COUNT(*) as total FROM comments ${where}`
    ).bind(...binds).first();

    return c.json({ comments: result.results, total: countRow ? countRow.total : 0 });
});

comments.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT id FROM comments WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

export default comments;
