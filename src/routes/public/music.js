/**
 * Public music API
 */
import { Hono } from 'hono';
import { fileUrl } from '../../utils/fileUrl.js';
import { optionalUserAuth } from '../../middleware/userAuth.js';
import { getPageGate, applyAnonGate } from '../../utils/pageAccess.js';

const publicMusic = new Hono();

publicMusic.get('/', optionalUserAuth, async (c) => {
    const albums = await c.env.DB.prepare(
        'SELECT id, slug, title, artist, type, year, gradient, cover_r2_key, description FROM albums WHERE is_published = 1 ORDER BY sort_order ASC, created_at ASC'
    ).all();

    const tracks = await c.env.DB.prepare(
        'SELECT t.id, t.album_id, t.title, t.duration, t.audio_r2_key, t.track_number, t.description, t.lyrics FROM tracks t JOIN albums a ON t.album_id = a.id WHERE t.is_published = 1 AND a.is_published = 1 ORDER BY t.track_number ASC'
    ).all();

    // Group tracks by album
    const tracksByAlbum = {};
    tracks.results.forEach(t => {
        if (!tracksByAlbum[t.album_id]) tracksByAlbum[t.album_id] = [];
        tracksByAlbum[t.album_id].push({
            title: t.title,
            duration: t.duration,
            src: fileUrl(c.env, t.audio_r2_key) || '',
            description: t.description || '',
            lyrics: t.lyrics || '',
        });
    });

    // View data — separate query so core content loads even if migration not yet applied
    let viewData = {};
    try {
        const vr = await c.env.DB.prepare(
            `SELECT a.id, a.show_views,
                (SELECT COUNT(*) FROM content_views WHERE content_type = 'album' AND content_id = a.id) as view_count
            FROM albums a WHERE a.is_published = 1`
        ).all();
        vr.results.forEach(v => { viewData[v.id] = { viewCount: v.view_count || 0, showViews: !!v.show_views }; });
    } catch (e) { /* migration not yet applied */ }

    const result = albums.results.map(a => {
        const vd = viewData[a.id] || { viewCount: 0, showViews: false };
        return {
            id: a.slug || a.id,
            numericId: a.id,
            title: a.title,
            artist: a.artist,
            type: a.type,
            year: String(a.year),
            gradient: a.gradient || 'gradient-1',
            coverUrl: fileUrl(c.env, a.cover_r2_key) || '',
            description: a.description || '',
            tracks: tracksByAlbum[a.id] || [],
            viewCount: vd.viewCount,
            showViews: vd.showViews,
        };
    });

    const gate = await getPageGate(c.env.DB, 'music');
    const gated = applyAnonGate(result, gate, c.get('user'));
    return c.json({ albums: gated.items, locked: gated.locked, total: gated.total, previewCount: gated.previewCount, requiredLevel: gated.requiredLevel });
});

export default publicMusic;
