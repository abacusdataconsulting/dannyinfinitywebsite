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

        // Idempotent: check if already processed
        const existing = await c.env.DB.prepare(
            'SELECT id FROM donations WHERE stripe_payment_id = ?'
        ).bind(stripeId).first();

        if (!existing) {
            const sheetMusicId = session.metadata?.sheet_music_id
                ? parseInt(session.metadata.sheet_music_id)
                : null;

            await c.env.DB.prepare(`
                INSERT INTO donations (stripe_payment_id, sheet_music_id, amount, currency, donor_email, donor_name)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
                stripeId,
                sheetMusicId,
                session.amount_total || 0,
                session.currency || 'usd',
                session.customer_details?.email || null,
                session.customer_details?.name || null
            ).run();
        }
    }

    return c.json({ received: true });
});

export default webhook;
