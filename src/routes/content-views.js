/**
 * Public content view recording route — passive, no auth required
 */
import { Hono } from 'hono';

const contentViews = new Hono();

const VALID_TYPES = ['album', 'blog', 'sheet', 'video', 'photo'];

/**
 * POST /api/content-view — Log a content view
 */
contentViews.post('/', async (c) => {
    try {
        let body;
        const ct = c.req.header('Content-Type') || '';
        if (ct.includes('application/json')) {
            body = await c.req.json();
        } else {
            const text = await c.req.text();
            body = JSON.parse(text);
        }

        if (!body.contentType || !VALID_TYPES.includes(body.contentType) || !body.contentId) {
            return c.json({ ok: false }, 400);
        }

        const ip = c.req.raw.headers.get('CF-Connecting-IP')
            || c.req.raw.headers.get('X-Forwarded-For')
            || 'unknown';

        await c.env.DB.prepare(
            'INSERT INTO content_views (content_type, content_id, ip_address) VALUES (?, ?, ?)'
        ).bind(body.contentType, parseInt(body.contentId), ip).run();

        return c.json({ ok: true });
    } catch (e) {
        console.error('content-view error:', e.message);
        return c.json({ ok: false }, 400);
    }
});

export default contentViews;
