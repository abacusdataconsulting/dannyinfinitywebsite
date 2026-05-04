/**
 * Stripe webhook handler — verifies signature and tracks donations
 */
import { Hono } from 'hono';

const webhook = new Hono();

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(payload, sigHeader, secret) {
    if (!sigHeader || !secret) return false;

    const parts = {};
    sigHeader.split(',').forEach(part => {
        const [key, value] = part.split('=');
        parts[key.trim()] = value;
    });

    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    // Check timestamp is within 5 minutes
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (age > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expected = bufferToHex(mac);

    // Timing-safe comparison
    if (expected.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
        result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
}

webhook.post('/stripe', async (c) => {
    const body = await c.req.text();
    const sig = c.req.header('stripe-signature');
    const secret = c.env.STRIPE_WEBHOOK_SECRET;

    const valid = await verifyStripeSignature(body, sig, secret);
    if (!valid) {
        return c.json({ error: 'Invalid signature' }, 400);
    }

    const event = JSON.parse(body);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const stripeId = session.id;
        const metadataType = session.metadata?.type;

        if (metadataType === 'purchase') {
            // --- Sheet music purchase ---
            const existing = await c.env.DB.prepare(
                'SELECT id FROM purchases WHERE stripe_session_id = ?'
            ).bind(stripeId).first();

            if (!existing) {
                // Generate secure download token (64 hex chars = 256 bits)
                const tokenBytes = new Uint8Array(32);
                crypto.getRandomValues(tokenBytes);
                const downloadToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');

                // Token expires in 72 hours
                const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

                const result = await c.env.DB.prepare(`
                    INSERT INTO purchases (stripe_session_id, buyer_email, buyer_name, amount_total, currency, download_token, token_expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    stripeId,
                    session.customer_details?.email || null,
                    session.customer_details?.name || null,
                    session.amount_total || 0,
                    session.currency || 'usd',
                    downloadToken,
                    expiresAt
                ).run();

                const purchaseId = result.meta.last_row_id;

                // Insert purchase items
                const sheetIds = (session.metadata?.sheet_ids || '').split(',').filter(Boolean).map(Number);
                for (const sheetId of sheetIds) {
                    const sheet = await c.env.DB.prepare(
                        'SELECT price_cents FROM sheet_music WHERE id = ?'
                    ).bind(sheetId).first();

                    await c.env.DB.prepare(
                        'INSERT INTO purchase_items (purchase_id, sheet_music_id, price_cents) VALUES (?, ?, ?)'
                    ).bind(purchaseId, sheetId, sheet?.price_cents || 0).run();
                }
            }
        } else {
            // --- Tip / donation ---
            const existing = await c.env.DB.prepare(
                'SELECT id FROM donations WHERE stripe_payment_id = ?'
            ).bind(stripeId).first();

            if (!existing) {
                const sheetMusicId = session.metadata?.sheet_music_id
                    ? parseInt(session.metadata.sheet_music_id)
                    : null;
                const tipType = session.metadata?.tip_type || 'unknown';
                const source = session.metadata?.source || (sheetMusicId ? 'sheet' : 'general');
                const sheetTitle = session.metadata?.sheet_title || null;

                await c.env.DB.prepare(`
                    INSERT INTO donations (stripe_payment_id, sheet_music_id, amount, currency, donor_email, donor_name, tip_type, source, sheet_title)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    stripeId,
                    sheetMusicId,
                    session.amount_total || 0,
                    session.currency || 'usd',
                    session.customer_details?.email || null,
                    session.customer_details?.name || null,
                    tipType,
                    source,
                    sheetTitle
                ).run();
            }
        }
    }

    return c.json({ received: true });
});

export default webhook;
