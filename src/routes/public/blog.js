/**
 * Public blog API
 */
import { Hono } from 'hono';

const publicBlog = new Hono();

publicBlog.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, slug, title, body, tag, published_at FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC, created_at DESC'
    ).all();

    return c.json({ posts: result.results });
});

export default publicBlog;
