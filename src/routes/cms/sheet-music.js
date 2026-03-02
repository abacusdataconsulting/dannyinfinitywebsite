/**
 * Sheet Music CMS routes — admin CRUD
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const sheetMusic = new Hono();

sheetMusic.use('*', adminAuth);

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// List all sheet music (including unpublished)
sheetMusic.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT * FROM sheet_music ORDER BY sort_order ASC, created_at DESC'
    ).all();
    return c.json({ sheets: result.results });
});

// Get single
sheetMusic.get('/:id', async (c) => {
    const id = c.req.param('id');
    const sheet = await c.env.DB.prepare('SELECT * FROM sheet_music WHERE id = ?').bind(id).first();
    if (!sheet) return c.json({ error: 'Not found' }, 404);
    return c.json(sheet);
});

// Create
sheetMusic.post('/', async (c) => {
    const body = await c.req.json();
    if (!body.title || !body.arrangement || !body.year) {
        return c.json({ error: 'title, arrangement, and year are required' }, 400);
    }

    const slug = slugify(body.title);
    const result = await c.env.DB.prepare(`
        INSERT INTO sheet_music (slug, title, composer, arrangement, year, pages, description, pdf_r2_key, tip_link, sort_order, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        slug,
        body.title,
        body.composer || 'Danny Infinity',
        body.arrangement,
        body.year,
        body.pages || 1,
        body.description || null,
        body.pdfR2Key || null,
        body.tipLink || null,
        body.sortOrder || 0,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : 1
    ).run();

    return c.json({ success: true, id: result.meta.last_row_id });
});

// Update
sheetMusic.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT * FROM sheet_music WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    const slug = body.title ? slugify(body.title) : existing.slug;

    await c.env.DB.prepare(`
        UPDATE sheet_music SET
            slug = ?, title = ?, composer = ?, arrangement = ?, year = ?,
            pages = ?, description = ?, pdf_r2_key = ?, tip_link = ?, sort_order = ?,
            is_published = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(
        slug,
        body.title ?? existing.title,
        body.composer ?? existing.composer,
        body.arrangement ?? existing.arrangement,
        body.year ?? existing.year,
        body.pages ?? existing.pages,
        body.description !== undefined ? body.description : existing.description,
        body.pdfR2Key !== undefined ? body.pdfR2Key : existing.pdf_r2_key,
        body.tipLink !== undefined ? body.tipLink : existing.tip_link,
        body.sortOrder ?? existing.sort_order,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
        id
    ).run();

    return c.json({ success: true });
});

// Delete
sheetMusic.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT pdf_r2_key FROM sheet_music WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    // Clean up R2 file
    if (existing.pdf_r2_key) {
        try { await c.env.R2.delete(existing.pdf_r2_key); } catch (e) { /* ignore */ }
    }

    await c.env.DB.prepare('DELETE FROM sheet_music WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

export default sheetMusic;
