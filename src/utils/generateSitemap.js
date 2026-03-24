/**
 * Dynamic XML sitemap generator
 */

const STATIC_PAGES = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/home.html', priority: '1.0', changefreq: 'weekly' },
    { loc: '/music.html', priority: '0.8', changefreq: 'monthly' },
    { loc: '/videos.html', priority: '0.8', changefreq: 'monthly' },
    { loc: '/photos.html', priority: '0.8', changefreq: 'monthly' },
    { loc: '/blog.html', priority: '0.9', changefreq: 'weekly' },
    { loc: '/sheet-music.html', priority: '0.9', changefreq: 'monthly' },
    { loc: '/weddings.html', priority: '0.7', changefreq: 'monthly' },
];

function escapeXml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function generateSitemap(env) {
    const base = 'https://dannyinfinity.com';

    // Build static page entries
    let urls = STATIC_PAGES.map(p =>
        `  <url>
    <loc>${base}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    );

    // Query published blog posts for dynamic entries
    try {
        const result = await env.DB.prepare(
            'SELECT slug, published_at FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC'
        ).all();

        for (const post of result.results || []) {
            const lastmod = post.published_at ? `\n    <lastmod>${escapeXml(post.published_at)}</lastmod>` : '';
            urls.push(
                `  <url>
    <loc>${base}/writings/${escapeXml(post.slug)}</loc>${lastmod}
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
            );
        }
    } catch (e) {
        // If DB query fails, still return static pages
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}
