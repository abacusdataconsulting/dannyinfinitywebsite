/**
 * Purchase route — creates Stripe Checkout Sessions for paid sheet music
 * Supports admin-defined coupon codes (percent or fixed amount off,
 * per-sheet or store-wide). Discounts are applied server-side.
 */
import { Hono } from 'hono';

const purchase = new Hono();

/**
 * Look up and validate a coupon code against a set of sheet IDs.
 * Returns { valid, coupon?, appliesTo?, message? }.
 */
async function validateCoupon(db, code, sheetIds) {
    if (!code || typeof code !== 'string' || !code.trim()) {
        return { valid: false, message: 'Enter a coupon code' };
    }
    const trimmed = code.trim().slice(0, 64);

    let coupon;
    try {
        coupon = await db.prepare(
            'SELECT * FROM coupons WHERE code = ? COLLATE NOCASE'
        ).bind(trimmed).first();
    } catch (e) {
        return { valid: false, message: 'Coupons are unavailable' };
    }

    if (!coupon || !coupon.is_active) return { valid: false, message: 'Invalid coupon code' };

    const expired = await db.prepare(
        "SELECT 1 AS ok FROM coupons WHERE id = ? AND expires_at IS NOT NULL AND expires_at <= datetime('now')"
    ).bind(coupon.id).first();
    if (expired) return { valid: false, message: 'This coupon has expired' };

    if (coupon.max_uses !== null && coupon.times_used >= coupon.max_uses) {
        return { valid: false, message: 'This coupon has reached its usage limit' };
    }

    const appliesTo = coupon.sheet_id === null
        ? sheetIds.slice()
        : sheetIds.filter(id => id === coupon.sheet_id);

    if (appliesTo.length === 0) {
        return { valid: false, message: 'This coupon does not apply to the items in your cart' };
    }

    return { valid: true, coupon, appliesTo };
}

function discountedCents(priceCents, coupon) {
    if (coupon.percent_off) {
        return Math.round(priceCents * (100 - coupon.percent_off) / 100);
    }
    return Math.max(0, priceCents - coupon.amount_off_cents);
}

/** Load + validate sheets for a list of IDs. Returns { sheetMap } or { error, status }. */
async function loadSheets(db, uniqueIds) {
    const placeholders = uniqueIds.map(() => '?').join(',');
    let sheets;
    try {
        sheets = await db.prepare(
            `SELECT id, title, price_cents, is_published FROM sheet_music WHERE id IN (${placeholders})`
        ).bind(...uniqueIds).all();
    } catch (dbErr) {
        console.error('DB error:', dbErr.message);
        return { error: 'Database error', status: 500 };
    }

    const sheetMap = new Map();
    for (const s of sheets.results) {
        sheetMap.set(s.id, s);
    }

    for (const id of uniqueIds) {
        const s = sheetMap.get(id);
        if (!s) return { error: `Sheet #${id} not found`, status: 404 };
        if (!s.is_published) return { error: `"${s.title}" is not available`, status: 400 };
        if (!s.price_cents || s.price_cents <= 0) return { error: `"${s.title}" is free — no purchase needed`, status: 400 };
    }

    return { sheetMap };
}

function parseSheetIds(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 20) return null;
    const sheetIds = items.map(i => parseInt(i.sheetId)).filter(id => id > 0);
    if (sheetIds.length !== items.length) return null;
    return [...new Set(sheetIds)];
}

/**
 * POST /api/purchase/validate-coupon
 * Body: { code, items: [{ sheetId }] }
 * Returns: { valid, code, percentOff, amountOffCents, appliesTo: [sheetId],
 *            items: [{ sheetId, originalCents, discountedCents }], message? }
 */
purchase.post('/validate-coupon', async (c) => {
    const body = await c.req.json();
    const uniqueIds = parseSheetIds(body.items);
    if (!uniqueIds) return c.json({ valid: false, message: 'Invalid items' }, 400);

    const loaded = await loadSheets(c.env.DB, uniqueIds);
    if (loaded.error) return c.json({ valid: false, message: loaded.error }, loaded.status);

    const result = await validateCoupon(c.env.DB, body.code, uniqueIds);
    if (!result.valid) return c.json({ valid: false, message: result.message });

    const { coupon, appliesTo } = result;
    const items = uniqueIds.map(id => {
        const s = loaded.sheetMap.get(id);
        const applies = appliesTo.includes(id);
        return {
            sheetId: id,
            originalCents: s.price_cents,
            discountedCents: applies ? discountedCents(s.price_cents, coupon) : s.price_cents,
        };
    });

    return c.json({
        valid: true,
        code: coupon.code,
        percentOff: coupon.percent_off || null,
        amountOffCents: coupon.amount_off_cents || null,
        appliesTo,
        items,
    });
});

/**
 * POST /api/purchase/create-session
 * Body (JSON): { items: [{ sheetId: 5 }, { sheetId: 12 }], couponCode?, returnPath? }
 * Returns: { url } — Stripe Checkout URL, or the download page URL when a
 * coupon brings the total to zero (no Stripe involved).
 */
purchase.post('/create-session', async (c) => {
    const body = await c.req.json();

    const uniqueIds = parseSheetIds(body.items);
    if (!uniqueIds) return c.json({ error: 'Provide 1-20 valid items' }, 400);

    const loaded = await loadSheets(c.env.DB, uniqueIds);
    if (loaded.error) return c.json({ error: loaded.error }, loaded.status);
    const sheetMap = loaded.sheetMap;

    // Apply coupon (re-validated server-side; a bad code fails the checkout
    // rather than silently charging full price)
    let coupon = null;
    let appliesTo = [];
    if (body.couponCode) {
        const result = await validateCoupon(c.env.DB, body.couponCode, uniqueIds);
        if (!result.valid) return c.json({ error: result.message || 'Invalid coupon' }, 400);
        coupon = result.coupon;
        appliesTo = result.appliesTo;
    }

    const finalPrice = (id) => {
        const s = sheetMap.get(id);
        return coupon && appliesTo.includes(id) ? discountedCents(s.price_cents, coupon) : s.price_cents;
    };
    const total = uniqueIds.reduce((sum, id) => sum + finalPrice(id), 0);

    // Validate returnPath
    let returnPath = '/sheet-music.html';
    if (body.returnPath && typeof body.returnPath === 'string'
        && body.returnPath.startsWith('/')
        && !body.returnPath.startsWith('//')
        && !/^\/[a-z]+:/i.test(body.returnPath)) {
        returnPath = body.returnPath;
    }

    // --- Zero-total (100% off): grant access directly, no Stripe ---
    if (coupon && total === 0) {
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const downloadToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

        const result = await c.env.DB.prepare(`
            INSERT INTO purchases (stripe_session_id, buyer_email, buyer_name, amount_total, currency, download_token, token_expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            'coupon_' + downloadToken.slice(0, 32),
            null, null, 0, 'usd',
            downloadToken, expiresAt
        ).run();

        const purchaseId = result.meta.last_row_id;
        for (const id of uniqueIds) {
            await c.env.DB.prepare(
                'INSERT INTO purchase_items (purchase_id, sheet_music_id, price_cents) VALUES (?, ?, ?)'
            ).bind(purchaseId, id, 0).run();
        }

        // No webhook will fire — count the use now
        await c.env.DB.prepare(
            'UPDATE coupons SET times_used = times_used + 1 WHERE id = ?'
        ).bind(coupon.id).run();

        return c.json({ url: '/download.html?token=' + downloadToken });
    }

    const origin = c.env.ALLOWED_ORIGIN && c.env.ALLOWED_ORIGIN !== '*'
        ? c.env.ALLOWED_ORIGIN
        : new URL(c.req.url).origin;

    // Build Stripe Checkout params
    const params = new URLSearchParams();
    params.append('mode', 'payment');

    let lineIdx = 0;
    uniqueIds.forEach((id) => {
        const price = finalPrice(id);
        if (price <= 0) return; // fully-discounted item in a mixed cart — granted via purchase record
        const s = sheetMap.get(id);
        params.append(`line_items[${lineIdx}][price_data][currency]`, 'usd');
        params.append(`line_items[${lineIdx}][price_data][unit_amount]`, String(price));
        params.append(`line_items[${lineIdx}][price_data][product_data][name]`, s.title);
        params.append(`line_items[${lineIdx}][quantity]`, '1');
        lineIdx++;
    });

    // Use Stripe's {CHECKOUT_SESSION_ID} template for the success URL
    params.append('success_url', origin + '/download.html?session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url', origin + returnPath);

    // Metadata for webhook — sheet_ids includes ALL purchased sheets (even
    // zero-priced ones in a mixed cart) so access is granted for everything
    params.append('metadata[type]', 'purchase');
    params.append('metadata[sheet_ids]', uniqueIds.join(','));
    if (coupon) params.append('metadata[coupon_code]', coupon.code);

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
            console.error('Stripe error:', data.error?.message, 'type:', data.error?.type, 'param:', data.error?.param);
            return c.json({ error: 'Payment processing error' }, 502);
        }

        return c.json({ url: data.url });
    } catch (err) {
        console.error('Stripe request failed:', err.message);
        return c.json({ error: 'Payment service error' }, 502);
    }
});

export default purchase;
