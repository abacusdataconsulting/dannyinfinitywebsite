/**
 * Public videos API
 */
import { Hono } from 'hono';
import { fileUrl, rewriteFileUrl } from '../../utils/fileUrl.js';

const publicVideos = new Hono();

publicVideos.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, slug, title, category, orientation, duration, video_type, video_src, thumbnail_r2_key, year FROM videos WHERE is_published = 1 ORDER BY sort_order ASC, created_at ASC'
    ).all();

    // View data — separate query so core content loads even if migration not yet applied
    let viewData = {};
    try {
        const vr = await c.env.DB.prepare(
            `SELECT v.id, v.show_views,
                (SELECT COUNT(*) FROM content_views WHERE content_type = 'video' AND content_id = v.id) as view_count
            FROM videos v WHERE v.is_published = 1`
        ).all();
        vr.results.forEach(v => { viewData[v.id] = { viewCount: v.view_count || 0, showViews: !!v.show_views }; });
    } catch (e) { /* migration not yet applied */ }

    const videos = result.results.map(v => {
        const vd = viewData[v.id] || { viewCount: 0, showViews: false };
        return {
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
            viewCount: vd.viewCount,
            showViews: vd.showViews,
        };
    });

    return c.json({ videos });
});

export default publicVideos;
