/**
 * Server-rendered individual writing (blog post) page
 */

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function sanitizeHtml(html) {
    if (!html) return '';
    // Remove <script> tags and their content
    html = html.replace(/<script[\s>][\s\S]*?<\/script>/gi, '');
    // Remove on* event handlers (onclick, onerror, onload, etc.)
    html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    // Remove javascript: URLs in href/src/action attributes
    html = html.replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');
    // Remove <iframe>, <object>, <embed>, <form>, <base>, <meta>, <link>, <style> tags
    html = html.replace(/<\/?(iframe|object|embed|form|base|meta|link|style)[\s>][^>]*>/gi, '');
    // Remove data: URLs in src attributes (potential XSS vector)
    html = html.replace(/(src)\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, '$1=""');
    return html;
}

function makeExcerpt(html, maxLen = 160) {
    const text = stripHtml(html);
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

export async function renderWritingPage(slug, env, request) {
    const post = await env.DB.prepare(
        'SELECT id, slug, title, body, tag, published_at FROM blog_posts WHERE slug = ? AND is_published = 1'
    ).bind(slug).first();

    if (!post) {
        return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const excerpt = escapeHtml(makeExcerpt(post.body));
    const safeTitle = escapeHtml(post.title);
    const canonicalUrl = `https://dannyinfinity.com/blog/${encodeURIComponent(post.slug)}`;
    const dateStr = post.published_at ? post.published_at.replace(/-/g, '.') : '';
    const isoDate = post.published_at || '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle} | Danny Infinity</title>
    <meta name="description" content="${excerpt}">
    <link rel="canonical" href="${canonicalUrl}">
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Danny Infinity">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${excerpt}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="https://dannyinfinity.com/assets/og-image.svg">
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${excerpt}">
    <meta name="twitter:image" content="https://dannyinfinity.com/assets/og-image.svg">
    <link rel="stylesheet" href="/css/global.css">
    <link rel="stylesheet" href="/css/blog.css">
</head>
<body>
    <a href="#main-content" class="sr-only sr-only-focusable">Skip to main content</a>
    <div class="blog-container container">
        <!-- Header -->
        <header class="site-header">
            <a href="/home.html" class="site-logo">DANNY<span class="logo-accent">INFINITY</span></a>
            <nav class="site-nav" aria-label="Main navigation">
                <a href="/home.html" class="nav-link">HOME</a>
                <a href="/music.html" class="nav-link">MUSIC</a>
                <a href="/videos.html" class="nav-link">VIDEOS</a>
                <a href="/photos.html" class="nav-link">PHOTOS</a>
                <a href="/blog.html" class="nav-link active">WRITINGS</a>
                <a href="/sheet-music.html" class="nav-link">SHEETS</a>
            </nav>
        </header>

        <article class="blog-post" id="main-content">
            <div class="post-header">
                <span class="post-date">${escapeHtml(dateStr)}</span>
            </div>
            <h1 class="post-title">${safeTitle}</h1>
            <div class="post-body">${sanitizeHtml(post.body || '')}</div>
            <div class="post-footer">
                <span class="post-terminal">&gt; END_OF_POST</span>
            </div>
        </article>

        <nav class="post-nav" style="padding:20px 0;text-align:center;">
            <a href="/blog.html" style="color:var(--text-secondary);">&larr; All Writings</a>
        </nav>

        <!-- Footer -->
        <footer class="site-footer">
            <div class="footer-content">
                <p class="footer-text">&gt; DANNY INFINITY // <span>${new Date().getFullYear()}</span></p>
            </div>
        </footer>
    </div>

    <!-- Structured Data: BlogPosting -->
    <script type="application/ld+json">
    ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        datePublished: isoDate,
        author: { '@type': 'Person', name: 'Danny Infinity' },
        url: canonicalUrl,
        description: stripHtml(post.body).slice(0, 200),
    })}
    </script>

    <script src="/js/cart.js"></script>
    <script src="/js/tracker.js"></script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
}
