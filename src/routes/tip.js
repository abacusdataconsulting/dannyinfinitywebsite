/**
 * Tip route — creates Stripe Checkout Sessions for donations
 */
import { Hono } from 'hono';

const tip = new Hono();

/**
 * POST /api/tip/create-session
 * Body (JSON): { amount, sheetMusicId?, sheetTitle?, returnPath? }
 * Returns: { url } — Stripe Checkout URL to redirect the browser to
 */
tip.post('/create-session', async (c) => {
    const body = await c.req.json();
    const amount = parseInt(body.amount, 10);

    if (!amount || amount < 100 || amount > 100000) {
        return c.json({ error: 'Amount must be between $1.00 and $1,000.00' }, 400);
    }

    const sheetMusicId = body.sheetMusicId ? String(body.sheetMusicId) : '';
    const sheetTitle = body.sheetTitle || '';
    const returnPath = body.returnPath || '/sheet-music.html';

    const productName = sheetTitle
        ? 'Tip — ' + sheetTitle
        : 'Tip — Support the Music';

    const origin = c.env.ALLOWED_ORIGIN && c.env.ALLOWED_ORIGIN !== '*'
        ? c.env.ALLOWED_ORIGIN
        : new URL(c.req.url).origin;
    const successUrl = origin + returnPath + (returnPath.includes('?') ? '&' : '?') + 'tip=success';
    const cancelUrl = origin + returnPath;

    // Build Stripe API form body
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('submit_type', 'donate');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', productName);
    params.append('line_items[0][price_data][unit_amount]', String(amount));
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
