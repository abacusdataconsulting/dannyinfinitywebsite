/**
 * Download route — secure, token-based PDF downloads for purchases
 * Includes a Stripe API fallback if the webhook hasn't processed yet.
 */
import { Hono } from 'hono';
import { createPurchaseFromSession } from './webhook.js';

const download = new Hono();

/**
 * GET /api/download/lookup?session_id=cs_xxx
 * Returns the download token for a Stripe session (post-checkout redirect).
 * Falls back to Stripe API if webhook hasn't created the record yet.
 */
download.get('/lookup', async (c) => {
    const sessionId = c.req.query('session_id');
    if (!sessionId) return c.json({ error: 'Missing session_id' }, 400);

    // Check if webhook already created the purchase
    let purchase = await c.env.DB.prepare(
        'SELECT download_token, token_expires_at FROM purchases WHERE stripe_session_id = ?'
    ).bind(sessionId).first();

    // Fallback: if not found, verify directly with Stripe and create the record
    if (!purchase) {
        const stripeKey = c.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            return c.json({ error: 'not_ready' }, 404);
        }

        try {
            const res = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId), {
                headers: { 'Authorization': 'Bearer ' + stripeKey },
            });

            if (!res.ok) {
                console.error('Stripe session lookup failed:', res.status);
                return c.json({ error: 'not_ready' }, 404);
            }

            const session = await res.json();

            // Verify this is a completed purchase
            if (session.payment_status !== 'paid' || session.metadata?.type !== 'purchase') {
                return c.json({ error: 'Invalid or incomplete session' }, 400);
            }

            // Create the purchase record (same logic as webhook)
            await createPurchaseFromSession(c.env.DB, session);

            // Re-fetch the record we just created
            purchase = await c.env.DB.prepare(
                'SELECT download_token, token_expires_at FROM purchases WHERE stripe_session_id = ?'
            ).bind(sessionId).first();

            if (!purchase) {
                return c.json({ error: 'Failed to create purchase record' }, 500);
            }

            console.log('DOWNLOAD: Created purchase via fallback for session', sessionId);
        } catch (err) {
            console.error('DOWNLOAD fallback error:', err.message);
            return c.json({ error: 'not_ready' }, 404);
        }
    }

    if (new Date(purchase.token_expires_at) < new Date()) {
        return c.json({ error: 'Download link has expired' }, 410);
    }

    return c.json({ token: purchase.download_token });
});

/**
 * GET /api/download/:token
 * Returns list of downloadable files for a purchase
 */
download.get('/:token', async (c) => {
    const token = c.req.param('token');

    const purchase = await c.env.DB.prepare(
        'SELECT id, token_expires_at, buyer_email, created_at FROM purchases WHERE download_token = ?'
    ).bind(token).first();

    if (!purchase) return c.json({ error: 'Invalid download link' }, 404);

    if (new Date(purchase.token_expires_at) < new Date()) {
        return c.json({ error: 'Download link has expired' }, 410);
    }

    const items = await c.env.DB.prepare(`
        SELECT pi.id as item_id, pi.sheet_music_id, pi.price_cents,
               sm.title, sm.composer, sm.arrangement
        FROM purchase_items pi
        JOIN sheet_music sm ON pi.sheet_music_id = sm.id
        WHERE pi.purchase_id = ?
    `).bind(purchase.id).all();

    return c.json({
        items: items.results.map(i => ({
            itemId: i.item_id,
            title: i.title,
            composer: i.composer,
            arrangement: i.arrangement,
            price: i.price_cents,
            downloadUrl: `/api/download/${token}/file/${i.item_id}`
        })),
        expiresAt: purchase.token_expires_at,
        purchasedAt: purchase.created_at
    });
});

/**
 * GET /api/download/:token/file/:itemId
 * Streams the actual PDF from R2
 */
download.get('/:token/file/:itemId', async (c) => {
    const token = c.req.param('token');
    const itemId = parseInt(c.req.param('itemId'));

    const purchase = await c.env.DB.prepare(
        'SELECT id, token_expires_at FROM purchases WHERE download_token = ?'
    ).bind(token).first();

    if (!purchase) return c.json({ error: 'Invalid download link' }, 404);

    if (new Date(purchase.token_expires_at) < new Date()) {
        return c.json({ error: 'Download link has expired' }, 410);
    }

    // Verify item belongs to this purchase
    const item = await c.env.DB.prepare(`
        SELECT pi.id, sm.pdf_r2_key, sm.title
        FROM purchase_items pi
        JOIN sheet_music sm ON pi.sheet_music_id = sm.id
        WHERE pi.id = ? AND pi.purchase_id = ?
    `).bind(itemId, purchase.id).first();

    if (!item || !item.pdf_r2_key) {
        return c.json({ error: 'File not found' }, 404);
    }

    const object = await c.env.R2.get(item.pdf_r2_key);
    if (!object) return c.json({ error: 'File not found' }, 404);

    const safeTitle = item.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'sheet-music';
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

export default download;
