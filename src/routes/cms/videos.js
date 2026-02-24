/**
 * Videos CMS routes — admin CRUD
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const videos = new Hono();
videos.use('*', adminAuth);

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// List all videos
videos.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT * FROM videos ORDER BY sort_order ASC, created_at DESC'
    ).all();
    return c.json({ videos: result.results });
});

// Get single
videos.get('/:id', async (c) => {
    const id = c.req.param('id');
    const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
    if (!video) return c.json({ error: 'Not found' }, 404);
    return c.json(video);
});

// Create
videos.post('/', async (c) => {
    const body = await c.req.json();
    if (!body.title) return c.json({ error: 'title is required' }, 400);

    const slug = slugify(body.title);
    const result = await c.env.DB.prepare(`
        INSERT INTO videos (slug, title, category, orientation, duration, video_type, video_src, thumbnail_r2_key, year, sort_order, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        slug,
        body.title,
        body.category || 'music-video',
        body.orientation || 'landscape',
        body.duration || '0:00',
        body.videoType || null,
        body.videoSrc || null,
        body.thumbnailR2Key || null,
        body.year || new Date().getFullYear(),
        body.sortOrder || 0,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : 1
    ).run();

    return c.json({ success: true, id: result.meta.last_row_id });
});

// Update
videos.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    const slug = body.title ? slugify(body.title) : existing.slug;

    await c.env.DB.prepare(`
        UPDATE videos SET
            slug = ?, title = ?, category = ?, orientation = ?,
            duration = ?, video_type = ?, video_src = ?,
            thumbnail_r2_key = ?, year = ?, sort_order = ?,
            is_published = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(
        slug,
        body.title ?? existing.title,
        body.category ?? existing.category,
        body.orientation ?? existing.orientation,
        body.duration ?? existing.duration,
        body.videoType !== undefined ? body.videoType : existing.video_type,
        body.videoSrc !== undefined ? body.videoSrc : existing.video_src,
        body.thumbnailR2Key !== undefined ? body.thumbnailR2Key : existing.thumbnail_r2_key,
        body.year ?? existing.year,
        body.sortOrder ?? existing.sort_order,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
        id
    ).run();

    return c.json({ success: true });
});

// Delete
videos.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT thumbnail_r2_key FROM videos WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    if (existing.thumbnail_r2_key) {
        try { await c.env.R2.delete(existing.thumbnail_r2_key); } catch (e) { /* ignore */ }
    }

    await c.env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

export default videos;
