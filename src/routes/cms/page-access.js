/**
 * Page access CMS routes — admin controls for per-page login requirements
 * and the anonymous preview gate on media pages.
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const PAGES = ['photos', 'videos', 'music', 'blog', 'sheet-music', 'streaming'];
const LEVELS = ['public', 'logged_in', 'subscriber', 'vip'];

const pageAccess = new Hono();
pageAccess.use('*', adminAuth);

// List settings for all known pages (defaults for rows not yet created)
pageAccess.get('/', async (c) => {
    let rows = [];
    try {
        const result = await c.env.DB.prepare('SELECT * FROM page_access').all();
        rows = result.results;
    } catch (e) {
        return c.json({ error: 'page_access table missing — run migration 017' }, 500);
    }

    const byPage = {};
    rows.forEach(r => { byPage[r.page] = r; });

    const pages = PAGES.map(page => byPage[page] || {
        page, required_level: 'public', gate_enabled: 0, anon_preview_count: 8,
    });

    return c.json({ pages });
});

// Update one page's settings
pageAccess.put('/:page', async (c) => {
    const page = c.req.param('page');
    if (!PAGES.includes(page)) return c.json({ error: 'Unknown page' }, 400);

    const body = await c.req.json();

    const requiredLevel = body.requiredLevel !== undefined ? String(body.requiredLevel) : 'public';
    if (!LEVELS.includes(requiredLevel)) return c.json({ error: 'Invalid access level' }, 400);

    const gateEnabled = body.gateEnabled ? 1 : 0;
    const previewCount = parseInt(body.anonPreviewCount);
    if (isNaN(previewCount) || previewCount < 0 || previewCount > 500) {
        return c.json({ error: 'Preview count must be between 0 and 500' }, 400);
    }

    await c.env.DB.prepare(`
        INSERT INTO page_access (page, required_level, gate_enabled, anon_preview_count)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(page) DO UPDATE SET
            required_level = excluded.required_level,
            gate_enabled = excluded.gate_enabled,
            anon_preview_count = excluded.anon_preview_count
    `).bind(page, requiredLevel, gateEnabled, previewCount).run();

    return c.json({ success: true });
});

export default pageAccess;
