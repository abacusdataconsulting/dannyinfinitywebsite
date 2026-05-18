/**
 * Public blog API
 */
import { Hono } from 'hono';

const publicBlog = new Hono();

publicBlog.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, slug, title, body, tag, published_at FROM blog_posts WHERE is_published = 1 ORDER BY published_at ASC, created_at ASC'
    ).all();

    return c.json({ posts: result.results });
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
