/**
 * Public videos API
 */
import { Hono } from 'hono';
import { fileUrl, rewriteFileUrl } from '../../utils/fileUrl.js';

const publicVideos = new Hono();

publicVideos.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, slug, title, category, orientation, duration, video_type, video_src, thumbnail_r2_key, year FROM videos WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC'
    ).all();

    const videos = result.results.map(v => ({
        id: v.id,
        slug: v.slug,
        title: v.title,
        category: v.category,
        orientation: v.orientation || 'landscape',
        duration: v.duration,
        videoType: v.video_type,
        videoSrc: rewriteFileUrl(c.env, v.video_src),
        thumbnailUrl: fileUrl(c.env, v.thumbnail_r2_key),
        year: v.year,
    }));

    return c.json({ videos });
});

export default publicVideos;
