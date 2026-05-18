/**
 * Public blog API
 */
import { Hono } from 'hono';

const publicBlog = new Hono();

publicBlog.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, slug, title, body, tag, published_at FROM blog_posts WHERE is_published = 1 ORDER BY published_at ASC, created_at ASC'
    ).all();

    // View data — separate query so core content loads even if migration not yet applied
    let viewData = {};
    try {
        const vr = await c.env.DB.prepare(
            `SELECT b.id, b.show_views,
                (SELECT COUNT(*) FROM content_views WHERE content_type = 'blog' AND content_id = b.id) as view_count
            FROM blog_posts b WHERE b.is_published = 1`
        ).all();
        vr.results.forEach(v => { viewData[v.id] = { view_count: v.view_count || 0, show_views: v.show_views }; });
    } catch (e) { /* migration not yet applied */ }

    const posts = result.results.map(p => ({
        ...p,
        view_count: (viewData[p.id] || {}).view_count || 0,
        show_views: (viewData[p.id] || {}).show_views || 0,
    }));

    return c.json({ posts });
});

publicBlog.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const post = await c.env.DB.prepare(
        'SELECT id, slug, title, body, tag, published_at FROM blog_posts WHERE slug = ? AND is_published = 1'
    ).bind(slug).first();

    if (!post) {
        return c.json({ error: 'Post not found' }, 404);
    }

    return c.json({ post });
});

export default publicBlog;
