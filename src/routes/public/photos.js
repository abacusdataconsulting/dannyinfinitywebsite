/**
 * Public photos API
 */
import { Hono } from 'hono';
import { fileUrl } from '../../utils/fileUrl.js';

const publicPhotos = new Hono();

publicPhotos.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, title, category, orientation, image_r2_key, date FROM photos WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC'
    ).all();

    const photos = result.results.map(p => ({
        id: p.id,
        title: p.title,
        category: p.category,
        orientation: p.orientation || 'landscape',
        imageUrl: fileUrl(c.env, p.image_r2_key),
        date: p.date,
    }));

    return c.json({ photos });
});

export default publicPhotos;
