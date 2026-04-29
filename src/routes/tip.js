/**
 * Tip route — creates Stripe Checkout Sessions for donations
 */
import { Hono } from 'hono';

const tip = new Hono();

// Allowed Stripe price IDs for preset tips
const VALID_PRICE_IDS = new Set([
    'price_1TRZ6kHHtHBqUIGao40NEFos',  // Tip $5
    'price_1TRZ7DHHtHBqUIGasXNJabWH',  // Tip $10
    'price_1TRZ7iHHtHBqUIGaTdrasWn9',  // Tip $25
    'price_1TRYyIHHtHBqUIGaGOihMBz4',  // Custom tip (Leave a tip for Danny)
]);

const CUSTOM_TIP_PRICE_ID = 'price_1TRYyIHHtHBqUIGaGOihMBz4';
const CUSTOM_TIP_PRODUCT_ID = 'prod_UQPnFr7Z6u1WBM';

/**
 * POST /api/tip/create-session
 * Body (JSON): { amount, priceId, sheetMusicId?, sheetTitle?, returnPath? }
 * Returns: { url } — Stripe Checkout URL to redirect the browser to
 */
tip.post('/create-session', async (c) => {
    const body = await c.req.json();
    const amount = parseInt(body.amount, 10);
    const priceId = body.priceId;

    if (!amount || amount < 100 || amount > 100000) {
        return c.json({ error: 'Amount must be between $1.00 and $1,000.00' }, 400);
    }

    if (!priceId || !VALID_PRICE_IDS.has(priceId)) {
        return c.json({ error: 'Invalid price selection' }, 400);
    }

    const sheetMusicId = body.sheetMusicId ? String(body.sheetMusicId) : '';
    const sheetTitle = body.sheetTitle || '';

    // Validate returnPath: must be a relative path, no protocol or double-slash
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
    const successUrl = origin + returnPath + (returnPath.includes('?') ? '&' : '?') + 'tip=success';
    const cancelUrl = origin + returnPath;

    // Build Stripe API form body
    const isCustom = priceId === CUSTOM_TIP_PRICE_ID;
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('submit_type', 'donate');

    if (isCustom) {
        // Custom amount — use price_data with the existing product
        params.append('line_items[0][price_data][currency]', 'usd');
        params.append('line_items[0][price_data][unit_amount]', String(amount));
        params.append('line_items[0][price_data][product]', CUSTOM_TIP_PRODUCT_ID);
    } else {
        // Preset amount — use the existing Stripe price directly
        params.append('line_items[0][price]', priceId);
    }
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);

    if (sheetMusicId) {
        params.append('metadata[sheet_music_id]', sheetMusicId);
    }

    const stripeKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        console.error('STRIPE_SECRET_KEY not configured');
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

export default tip;
