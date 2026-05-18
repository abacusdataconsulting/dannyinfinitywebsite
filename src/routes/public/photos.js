/**
 * Public photos API
 */
import { Hono } from 'hono';
import { fileUrl } from '../../utils/fileUrl.js';

const publicPhotos = new Hono();

publicPhotos.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, title, category, orientation, image_r2_key, date FROM photos WHERE is_published = 1 ORDER BY sort_order ASC, created_at ASC'
    ).all();

    // View data — separate query so core content loads even if migration not yet applied
    let viewData = {};
    try {
        const vr = await c.env.DB.prepare(
            `SELECT p.id, p.show_views,
                (SELECT COUNT(*) FROM content_views WHERE content_type = 'photo' AND content_id = p.id) as view_count
            FROM photos p WHERE p.is_published = 1`
        ).all();
        vr.results.forEach(v => { viewData[v.id] = { viewCount: v.view_count || 0, showViews: !!v.show_views }; });
    } catch (e) { /* migration not yet applied */ }

    const photos = result.results.map(p => {
        const vd = viewData[p.id] || { viewCount: 0, showViews: false };
        return {
            id: p.id,
            title: p.title,
            category: p.category,
            orientation: p.orientation || 'landscape',
            imageUrl: fileUrl(c.env, p.image_r2_key),
            date: p.date,
            viewCount: vd.viewCount,
            showViews: vd.showViews,
        };
    });

    return c.json({ photos });
});

export default publicPhotos;
