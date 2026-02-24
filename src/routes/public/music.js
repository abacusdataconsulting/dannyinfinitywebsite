/**
 * Public music API
 */
import { Hono } from 'hono';

const publicMusic = new Hono();

publicMusic.get('/', async (c) => {
    const albums = await c.env.DB.prepare(
        'SELECT id, slug, title, artist, type, year, gradient FROM albums WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC'
    ).all();

    const tracks = await c.env.DB.prepare(
        'SELECT t.id, t.album_id, t.title, t.duration, t.audio_r2_key, t.track_number FROM tracks t JOIN albums a ON t.album_id = a.id WHERE t.is_published = 1 AND a.is_published = 1 ORDER BY t.track_number ASC'
    ).all();

    // Group tracks by album
    const tracksByAlbum = {};
    tracks.results.forEach(t => {
        if (!tracksByAlbum[t.album_id]) tracksByAlbum[t.album_id] = [];
        tracksByAlbum[t.album_id].push({
            title: t.title,
            duration: t.duration,
            src: t.audio_r2_key ? `/api/files/${t.audio_r2_key}` : '',
        });
    });

    const result = albums.results.map(a => ({
        id: a.slug || a.id,
        title: a.title,
        artist: a.artist,
        type: a.type,
        year: String(a.year),
        gradient: a.gradient || 'gradient-1',
        tracks: tracksByAlbum[a.id] || [],
    }));

    return c.json({ albums: result });
});

export default publicMusic;
