/**
 * Server-rendered individual sheet music page for SEO
 */

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function makeExcerpt(text, maxLen = 160) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

function formatPrice(cents) {
    return '$' + (cents / 100).toFixed(2);
}

export async function renderSheetPage(slug, env, request) {
    const sheet = await env.DB.prepare(
        "SELECT id, slug, title, composer, arrangement, year, pages, description, price_cents, pdf_r2_key, tip_link, visibility FROM sheet_music WHERE slug = ? AND is_published = 1 AND visibility = 'public'"
    ).bind(slug).first();

    if (!sheet) {
        return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const safeTitle = escapeHtml(sheet.title);
    const safeComposer = escapeHtml(sheet.composer || 'Danny Infinity');
    const safeArrangement = escapeHtml(sheet.arrangement || '');
    const safeDescription = escapeHtml(sheet.description || '');
    const excerpt = escapeHtml(makeExcerpt(sheet.description || `${sheet.title} — ${sheet.arrangement} by ${sheet.composer || 'Danny Infinity'}`));
    const canonicalUrl = `https://dannyinfinity.com/sheets/${encodeURIComponent(sheet.slug)}`;
    const isPaid = sheet.price_cents > 0;
    const priceDisplay = isPaid ? formatPrice(sheet.price_cents) : 'Free';

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'MusicComposition',
        name: sheet.title,
        composer: { '@type': 'Person', name: sheet.composer || 'Danny Infinity' },
        description: sheet.description || '',
        url: canonicalUrl,
    };
    if (isPaid) {
        structuredData.offers = {
            '@type': 'Offer',
            price: (sheet.price_cents / 100).toFixed(2),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
        };
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle} — Sheet Music | Danny Infinity</title>
    <meta name="description" content="${excerpt}">
    <link rel="canonical" href="${canonicalUrl}">
    <!-- Open Graph -->
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="Danny Infinity">
    <meta property="og:title" content="${safeTitle} — Sheet Music">
    <meta property="og:description" content="${excerpt}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="https://dannyinfinity.com/assets/og-image.svg">
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle} — Sheet Music">
    <meta name="twitter:description" content="${excerpt}">
    <meta name="twitter:image" content="https://dannyinfinity.com/assets/og-image.svg">
    <link rel="stylesheet" href="/css/global.css">
    <link rel="stylesheet" href="/css/sheet-music.css">
    <!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-MN1GHGMM5N"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-MN1GHGMM5N');</script>
</head>
<body>
    <a href="#main-content" class="sr-only sr-only-focusable">Skip to main content</a>
    <div class="sheets-container container">
        <!-- Header -->
        <header class="site-header">
            <a href="/home.html" class="site-logo">DANNY<span class="logo-accent">INFINITY</span></a>
            <nav class="site-nav" aria-label="Main navigation">
                <a href="/home.html" class="nav-link">HOME</a>
                <a href="/music.html" class="nav-link">MUSIC</a>
                <a href="/videos.html" class="nav-link">VIDEOS</a>
                <a href="/photos.html" class="nav-link">PHOTOS</a>
                <a href="/blog.html" class="nav-link">WRITINGS</a>
                <a href="/sheet-music.html" class="nav-link active">SHEETS</a>
            </nav>
        </header>

        <article class="sheet-detail" id="main-content" style="max-width:800px;margin:40px auto;padding:0 20px;">
            <h1 style="font-size:2rem;font-weight:700;letter-spacing:3px;margin-bottom:15px;">${safeTitle}</h1>

            <div style="margin-bottom:25px;line-height:2;">
                <p class="preview-field"><span class="field-label">Composer:</span> ${safeComposer}</p>
                <p class="preview-field"><span class="field-label">Arrangement:</span> ${safeArrangement}</p>
                <p class="preview-field"><span class="field-label">Year:</span> ${escapeHtml(String(sheet.year || ''))}</p>
                <p class="preview-field"><span class="field-label">Pages:</span> ${escapeHtml(String(sheet.pages || ''))}</p>
                <p class="preview-field"><span class="field-label">Price:</span> ${priceDisplay}</p>
            </div>

            ${safeDescription ? `<div style="margin-bottom:30px;line-height:1.8;opacity:0.85;font-size:0.95rem;">${safeDescription}</div>` : ''}

            <div style="display:flex;flex-direction:column;gap:12px;max-width:350px;margin-bottom:40px;">
                <a href="/sheet-music.html#${escapeHtml(sheet.slug)}" class="action-btn" style="display:block;text-align:center;padding:15px 25px;border:2px solid var(--border-color);font-size:0.95rem;letter-spacing:2px;">${isPaid ? '[VIEW & PURCHASE]' : '[VIEW & DOWNLOAD]'}</a>
            </div>
        </article>

        <nav style="text-align:center;padding:20px 0;">
            <a href="/sheet-music.html" style="color:var(--text-secondary);letter-spacing:2px;font-size:0.9rem;">&larr; All Sheet Music</a>
        </nav>

        <!-- Footer -->
        <footer class="site-footer">
            <div class="footer-content">
                <p class="footer-text">&gt; DANNY INFINITY // <span>${new Date().getFullYear()}</span></p>
            </div>
        </footer>
    </div>

    <!-- Structured Data -->
    <script type="application/ld+json">
    ${JSON.stringify(structuredData)}
    </script>

    <script src="/js/cart.js"></script>
    <script src="/js/tracker.js"></script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
}
