/**
 * Photos CMS routes — admin CRUD
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const photos = new Hono();
photos.use('*', adminAuth);

// List all photos
photos.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT * FROM photos ORDER BY sort_order ASC, created_at DESC'
    ).all();
    return c.json({ photos: result.results });
});

// Get single
photos.get('/:id', async (c) => {
    const id = c.req.param('id');
    const photo = await c.env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first();
    if (!photo) return c.json({ error: 'Not found' }, 404);
    return c.json(photo);
});

// Create
photos.post('/', async (c) => {
    const body = await c.req.json();
    if (!body.title) return c.json({ error: 'title is required' }, 400);

    const result = await c.env.DB.prepare(`
        INSERT INTO photos (title, category, orientation, image_r2_key, date, sort_order, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
        body.title,
        body.category || 'live',
        body.orientation || 'landscape',
        body.imageR2Key || null,
        body.date || new Date().toISOString().split('T')[0],
        body.sortOrder || 0,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : 1
    ).run();

    return c.json({ success: true, id: result.meta.last_row_id });
});

// Update
photos.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    await c.env.DB.prepare(`
        UPDATE photos SET
            title = ?, category = ?, orientation = ?,
            image_r2_key = ?, date = ?, sort_order = ?,
            is_published = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(
        body.title ?? existing.title,
        body.category ?? existing.category,
        body.orientation ?? existing.orientation,
        body.imageR2Key !== undefined ? body.imageR2Key : existing.image_r2_key,
        body.date ?? existing.date,
        body.sortOrder ?? existing.sort_order,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
        id
    ).run();

    return c.json({ success: true });
});

// Delete
photos.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT image_r2_key FROM photos WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    if (existing.image_r2_key) {
        try { await c.env.R2.delete(existing.image_r2_key); } catch (e) { /* ignore */ }
    }

    await c.env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

export default photos;
