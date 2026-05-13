/**
 * User library routes — link purchases to accounts, view owned sheets, download
 */
import { Hono } from 'hono';
import { requireUserAuth } from '../middleware/userAuth.js';

const library = new Hono();

library.use('*', requireUserAuth);

/**
 * POST /api/user/library/link-purchase
 * Body: { downloadToken }
 * Links a purchase (and its sheet items) to the logged-in user's account.
 */
library.post('/link-purchase', async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const token = body.downloadToken;

    if (!token || typeof token !== 'string') {
        return c.json({ error: 'downloadToken is required' }, 400);
    }

    // Find the purchase
    const purchase = await c.env.DB.prepare(
        'SELECT id, user_id FROM purchases WHERE download_token = ?'
    ).bind(token).first();

    if (!purchase) {
        return c.json({ error: 'Purchase not found' }, 404);
    }

    // If already linked to a different user, deny
    if (purchase.user_id && purchase.user_id !== user.id) {
        return c.json({ error: 'This purchase is already linked to another account' }, 409);
    }

    // Link purchase to user
    if (!purchase.user_id) {
        await c.env.DB.prepare(
            'UPDATE purchases SET user_id = ? WHERE id = ?'
        ).bind(user.id, purchase.id).run();
    }

    // Get items from this purchase
    const items = await c.env.DB.prepare(
        'SELECT sheet_music_id FROM purchase_items WHERE purchase_id = ?'
    ).bind(purchase.id).all();

    // Grant access for each sheet
    let granted = 0;
    for (const item of items.results) {
        try {
            await c.env.DB.prepare(
                "INSERT OR IGNORE INTO user_sheet_access (user_id, sheet_music_id, source, purchase_id) VALUES (?, ?, 'purchase', ?)"
            ).bind(user.id, item.sheet_music_id, purchase.id).run();
            granted++;
        } catch (e) {
            // UNIQUE constraint — already has access, skip
        }
    }

    return c.json({ success: true, sheetsLinked: granted });
});

/**
 * GET /api/user/library/sheets
 * Returns all sheets the user has access to (purchased or admin-granted).
 */
library.get('/sheets', async (c) => {
    const user = c.get('user');

    const result = await c.env.DB.prepare(`
        SELECT sm.id, sm.slug, sm.title, sm.composer, sm.arrangement, sm.year,
               sm.pages, sm.description, sm.pdf_r2_key, sm.price_cents,
               usa.source, usa.created_at as access_granted_at
        FROM user_sheet_access usa
        JOIN sheet_music sm ON usa.sheet_music_id = sm.id
        WHERE usa.user_id = ?
        ORDER BY usa.created_at DESC
    `).bind(user.id).all();

    const sheets = result.results.map(s => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        composer: s.composer,
        arrangement: s.arrangement,
        year: s.year,
        pages: s.pages,
        description: s.description || '',
        price: s.price_cents || 0,
        source: s.source,
        accessGrantedAt: s.access_granted_at,
        downloadUrl: `/api/user/library/download/${s.id}`,
    }));

    return c.json({ sheets });
});

/**
 * GET /api/user/library/download/:sheetId
 * Streams the PDF for a sheet the user has access to.
 */
library.get('/download/:sheetId', async (c) => {
    const user = c.get('user');
    const sheetId = parseInt(c.req.param('sheetId'));

    // Check access
    const access = await c.env.DB.prepare(
        'SELECT id FROM user_sheet_access WHERE user_id = ? AND sheet_music_id = ?'
    ).bind(user.id, sheetId).first();

    if (!access && !user.isAdmin) {
        return c.json({ error: 'Access denied' }, 403);
    }

    // Get sheet info
    const sheet = await c.env.DB.prepare(
        'SELECT title, pdf_r2_key FROM sheet_music WHERE id = ?'
    ).bind(sheetId).first();

    if (!sheet || !sheet.pdf_r2_key) {
        return c.json({ error: 'File not found' }, 404);
    }

    const object = await c.env.R2.get(sheet.pdf_r2_key);
    if (!object) return c.json({ error: 'File not found' }, 404);

    const safeTitle = sheet.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'sheet-music';
    const filename = `${safeTitle}.pdf`;

    return new Response(object.body, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(object.size),
            'Cache-Control': 'no-store',
        },
    });
});

export default library;
