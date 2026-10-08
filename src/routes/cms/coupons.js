/**
 * Coupons CMS routes — admin CRUD for sheet-music coupon codes
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const coupons = new Hono();
coupons.use('*', adminAuth);

function parseDiscount(body) {
    const percentOff = body.percentOff != null && body.percentOff !== '' ? parseInt(body.percentOff) : null;
    const amountOffCents = body.amountOffCents != null && body.amountOffCents !== '' ? parseInt(body.amountOffCents) : null;

    if ((percentOff === null) === (amountOffCents === null)) {
        return { error: 'Set either a percent discount or a fixed amount (not both)' };
    }
    if (percentOff !== null && (isNaN(percentOff) || percentOff < 1 || percentOff > 100)) {
        return { error: 'Percent off must be between 1 and 100' };
    }
    if (amountOffCents !== null && (isNaN(amountOffCents) || amountOffCents < 1)) {
        return { error: 'Amount off must be at least 1 cent' };
    }
    return { percentOff, amountOffCents };
}

function parseOptionalFields(body) {
    const sheetId = body.sheetId ? parseInt(body.sheetId) : null;
    const maxUses = body.maxUses != null && body.maxUses !== '' ? parseInt(body.maxUses) : null;
    const expiresAt = body.expiresAt ? String(body.expiresAt) : null;
    if (maxUses !== null && (isNaN(maxUses) || maxUses < 1)) {
        return { error: 'Max uses must be at least 1' };
    }
    return { sheetId: sheetId && sheetId > 0 ? sheetId : null, maxUses, expiresAt };
}

// List all coupons (with sheet titles)
coupons.get('/', async (c) => {
    const result = await c.env.DB.prepare(`
        SELECT cp.*, sm.title AS sheet_title
        FROM coupons cp
        LEFT JOIN sheet_music sm ON cp.sheet_id = sm.id
        ORDER BY cp.created_at DESC
    `).all();
    return c.json({ coupons: result.results });
});

// Create coupon
coupons.post('/', async (c) => {
    const body = await c.req.json();

    const code = String(body.code || '').trim();
    if (!code || code.length > 64) return c.json({ error: 'A code (max 64 chars) is required' }, 400);

    const discount = parseDiscount(body);
    if (discount.error) return c.json({ error: discount.error }, 400);

    const opts = parseOptionalFields(body);
    if (opts.error) return c.json({ error: opts.error }, 400);

    try {
        const result = await c.env.DB.prepare(`
            INSERT INTO coupons (code, percent_off, amount_off_cents, sheet_id, max_uses, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            code,
            discount.percentOff,
            discount.amountOffCents,
            opts.sheetId,
            opts.maxUses,
            opts.expiresAt,
            body.isActive !== undefined ? (body.isActive ? 1 : 0) : 1
        ).run();
        return c.json({ success: true, id: result.meta.last_row_id });
    } catch (e) {
        if (String(e.message).includes('UNIQUE')) {
            return c.json({ error: 'A coupon with that code already exists' }, 400);
        }
        throw e;
    }
});

// Update coupon
coupons.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    const code = body.code !== undefined ? String(body.code).trim() : existing.code;
    if (!code || code.length > 64) return c.json({ error: 'A code (max 64 chars) is required' }, 400);

    const discount = parseDiscount({
        percentOff: body.percentOff !== undefined ? body.percentOff : existing.percent_off,
        amountOffCents: body.amountOffCents !== undefined ? body.amountOffCents : existing.amount_off_cents,
    });
    if (discount.error) return c.json({ error: discount.error }, 400);

    const opts = parseOptionalFields({
        sheetId: body.sheetId !== undefined ? body.sheetId : existing.sheet_id,
        maxUses: body.maxUses !== undefined ? body.maxUses : existing.max_uses,
        expiresAt: body.expiresAt !== undefined ? body.expiresAt : existing.expires_at,
    });
    if (opts.error) return c.json({ error: opts.error }, 400);

    try {
        await c.env.DB.prepare(`
            UPDATE coupons SET
                code = ?, percent_off = ?, amount_off_cents = ?,
                sheet_id = ?, max_uses = ?, expires_at = ?, is_active = ?
            WHERE id = ?
        `).bind(
            code,
            discount.percentOff,
            discount.amountOffCents,
            opts.sheetId,
            opts.maxUses,
            opts.expiresAt,
            body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
            id
        ).run();
        return c.json({ success: true });
    } catch (e) {
        if (String(e.message).includes('UNIQUE')) {
            return c.json({ error: 'A coupon with that code already exists' }, 400);
        }
        throw e;
    }
});

// Delete coupon (hard delete — past uses are recorded on purchases via metadata)
coupons.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT id FROM coupons WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

export default coupons;
