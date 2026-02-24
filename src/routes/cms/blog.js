/**
 * Blog CMS routes — admin CRUD
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const blog = new Hono();
blog.use('*', adminAuth);

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// List all posts
blog.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT * FROM blog_posts ORDER BY published_at DESC, created_at DESC'
    ).all();
    return c.json({ posts: result.results });
});

// Get single post
blog.get('/:id', async (c) => {
    const id = c.req.param('id');
    const post = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first();
    if (!post) return c.json({ error: 'Not found' }, 404);
    return c.json(post);
});

// Create post
blog.post('/', async (c) => {
    const body = await c.req.json();
    if (!body.title) return c.json({ error: 'title is required' }, 400);

    const slug = slugify(body.title);
    const result = await c.env.DB.prepare(`
        INSERT INTO blog_posts (slug, title, body, tag, published_at, is_published)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
        slug,
        body.title,
        body.body || '',
        body.tag || 'UPDATE',
        body.publishedAt || new Date().toISOString().split('T')[0],
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : 1
    ).run();

    return c.json({ success: true, id: result.meta.last_row_id });
});

// Update post
blog.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    const slug = body.title ? slugify(body.title) : existing.slug;

    await c.env.DB.prepare(`
        UPDATE blog_posts SET
            slug = ?, title = ?, body = ?, tag = ?,
            published_at = ?, is_published = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(
        slug,
        body.title ?? existing.title,
        body.body ?? existing.body,
        body.tag ?? existing.tag,
        body.publishedAt ?? existing.published_at,
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
        id
    ).run();

    return c.json({ success: true });
});

// Delete post
blog.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT id FROM blog_posts WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Not found' }, 404);

    await c.env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

export default blog;
