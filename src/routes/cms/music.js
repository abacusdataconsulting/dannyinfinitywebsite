/**
 * Music CMS routes — admin CRUD for albums + tracks
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const music = new Hono();
music.use('*', adminAuth);

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// List all albums (with track counts)
music.get('/', async (c) => {
    const albums = await c.env.DB.prepare(
        'SELECT * FROM albums ORDER BY sort_order ASC, created_at DESC'
    ).all();

    const trackCounts = await c.env.DB.prepare(
        'SELECT album_id, COUNT(*) as count FROM tracks GROUP BY album_id'
    ).all();

    const countMap = {};
    trackCounts.results.forEach(r => { countMap[r.album_id] = r.count; });

    const result = albums.results.map(a => ({
        ...a,
        trackCount: countMap[a.id] || 0,
    }));

    return c.json({ albums: result });
});

// Get single album with tracks
music.get('/:id', async (c) => {
    const id = c.req.param('id');
    const album = await c.env.DB.prepare('SELECT * FROM albums WHERE id = ?').bind(id).first();
    if (!album) return c.json({ error: 'Not found' }, 404);

    const tracks = await c.env.DB.prepare(
        'SELECT * FROM tracks WHERE album_id = ? ORDER BY track_number ASC'
    ).bind(id).all();

    return c.json({ ...album, tracks: tracks.results });
});

// Create album
music.post('/', async (c) => {
    const body = await c.req.json();
    if (!body.title) return c.json({ error: 'title is required' }, 400);

    const slug = slugify(body.title);
    const result = await c.env.DB.prepare(`
        INSERT INTO albums (slug, title, artist, type, year, gradient, sort_order, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        slug,
        body.title,
        body.artist || 'Danny Infinity',
        body.type || 'Album',
        body.year || new Date().getFullYear(),
        body.gradient || 'gradient-1',
        body.sortOrder || 0,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : 1
    ).run();

    return c.json({ success: true, id: result.meta.last_row_id });
});

// Update album
music.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT * FROM albums WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    const slug = body.title ? slugify(body.title) : existing.slug;

    await c.env.DB.prepare(`
        UPDATE albums SET
            slug = ?, title = ?, artist = ?, type = ?, year = ?,
            gradient = ?, sort_order = ?, is_published = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(
        slug,
        body.title ?? existing.title,
        body.artist ?? existing.artist,
        body.type ?? existing.type,
        body.year ?? existing.year,
        body.gradient ?? existing.gradient,
        body.sortOrder ?? existing.sort_order,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
        id
    ).run();

    return c.json({ success: true });
});

// Delete album (cascades to tracks via FK or manual)
music.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT id FROM albums WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    // Clean up track audio files from R2
    const tracks = await c.env.DB.prepare(
        'SELECT audio_r2_key FROM tracks WHERE album_id = ? AND audio_r2_key IS NOT NULL'
    ).bind(id).all();

    for (const track of tracks.results) {
        try { await c.env.R2.delete(track.audio_r2_key); } catch (e) { /* ignore */ }
    }

    await c.env.DB.prepare('DELETE FROM tracks WHERE album_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// ---- TRACKS ----

// Add track to album
music.post('/:albumId/tracks', async (c) => {
    const albumId = c.req.param('albumId');
    const body = await c.req.json();
    if (!body.title) return c.json({ error: 'title is required' }, 400);

    // Get next track number
    const maxTrack = await c.env.DB.prepare(
        'SELECT MAX(track_number) as max_num FROM tracks WHERE album_id = ?'
    ).bind(albumId).first();
    const trackNumber = body.trackNumber || (maxTrack.max_num || 0) + 1;

    const result = await c.env.DB.prepare(`
        INSERT INTO tracks (album_id, title, duration, audio_r2_key, track_number, is_published)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
        albumId,
        body.title,
        body.duration || '0:00',
        body.audioR2Key || null,
        trackNumber,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : 1
    ).run();

    return c.json({ success: true, id: result.meta.last_row_id });
});

// Update track
music.put('/tracks/:trackId', async (c) => {
    const trackId = c.req.param('trackId');
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT * FROM tracks WHERE id = ?').bind(trackId).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    await c.env.DB.prepare(`
        UPDATE tracks SET
            title = ?, duration = ?, audio_r2_key = ?,
            track_number = ?, is_published = ?
        WHERE id = ?
    `).bind(
        body.title ?? existing.title,
        body.duration ?? existing.duration,
        body.audioR2Key !== undefined ? body.audioR2Key : existing.audio_r2_key,
        body.trackNumber ?? existing.track_number,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
        trackId
    ).run();

    return c.json({ success: true });
});

// Delete track
music.delete('/tracks/:trackId', async (c) => {
    const trackId = c.req.param('trackId');
    const existing = await c.env.DB.prepare('SELECT audio_r2_key FROM tracks WHERE id = ?').bind(trackId).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    if (existing.audio_r2_key) {
        try { await c.env.R2.delete(existing.audio_r2_key); } catch (e) { /* ignore */ }
    }

    await c.env.DB.prepare('DELETE FROM tracks WHERE id = ?').bind(trackId).run();
    return c.json({ success: true });
});

export default music;
