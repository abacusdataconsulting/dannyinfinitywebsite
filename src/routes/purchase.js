/**
 * Purchase route — creates Stripe Checkout Sessions for paid sheet music
 */
import { Hono } from 'hono';

const purchase = new Hono();

/**
 * POST /api/purchase/create-session
 * Body (JSON): { items: [{ sheetId: 5 }, { sheetId: 12 }], returnPath? }
 * Returns: { url } — Stripe Checkout URL
 */
purchase.post('/create-session', async (c) => {
    const body = await c.req.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
        return c.json({ error: 'Provide 1-20 items' }, 400);
    }

    const sheetIds = items.map(i => parseInt(i.sheetId)).filter(id => id > 0);
    if (sheetIds.length !== items.length) {
        return c.json({ error: 'Invalid item IDs' }, 400);
    }

    // Deduplicate
    const uniqueIds = [...new Set(sheetIds)];

    // Look up all sheets
    const placeholders = uniqueIds.map(() => '?').join(',');
    const sheets = await c.env.DB.prepare(
        `SELECT id, title, price_cents, is_published FROM sheet_music WHERE id IN (${placeholders})`
    ).bind(...uniqueIds).all();

    const sheetMap = new Map();
    for (const s of sheets.results) {
        sheetMap.set(s.id, s);
    }

    // Validate all sheets
    for (const id of uniqueIds) {
        const s = sheetMap.get(id);
        if (!s) return c.json({ error: `Sheet #${id} not found` }, 404);
        if (!s.is_published) return c.json({ error: `"${s.title}" is not available` }, 400);
        if (!s.price_cents || s.price_cents <= 0) return c.json({ error: `"${s.title}" is free — no purchase needed` }, 400);
    }

    // Validate returnPath
    let returnPath = '/sheet-music.html';
    if (body.returnPath && typeof body.returnPath === 'string'
        && body.returnPath.startsWith('/')
        && !body.returnPath.startsWith('//')
        && !/^\/[a-z]+:/i.test(body.returnPath)) {
        returnPath = body.returnPath;
    }

    const origin = c.env.ALLOWED_ORIGIN && c.env.ALLOWED_ORIGIN !== '*'
        ? c.env.ALLOWED_ORIGIN
        : new URL(c.req.url).origin;

    // Build Stripe Checkout params
    const params = new URLSearchParams();
    params.append('mode', 'payment');

    uniqueIds.forEach((id, idx) => {
        const s = sheetMap.get(id);
        params.append(`line_items[${idx}][price_data][currency]`, 'usd');
        params.append(`line_items[${idx}][price_data][unit_amount]`, String(s.price_cents));
        params.append(`line_items[${idx}][price_data][product_data][name]`, s.title);
        params.append(`line_items[${idx}][quantity]`, '1');
    });

    // Use Stripe's {CHECKOUT_SESSION_ID} template for the success URL
    params.append('success_url', origin + '/download.html?session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url', origin + returnPath);

    // Metadata for webhook
    params.append('metadata[type]', 'purchase');
    params.append('metadata[sheet_ids]', uniqueIds.join(','));

    const stripeKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        return c.json({ error: 'Payment system unavailable' }, 503);
    }

    try {
        const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + stripeKey,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('Stripe error:', data.error?.message);
            return c.json({ error: 'Failed to create checkout session' }, 502);
        }

        return c.json({ url: data.url });
    } catch (err) {
        console.error('Stripe request failed:', err.message);
        return c.json({ error: 'Payment service error' }, 502);
    }
});

export default purchase;
