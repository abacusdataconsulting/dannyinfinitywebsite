/**
 * File serving route — streams files from R2 with Cloudflare edge caching
 *
 * Full (non-range) requests are cached at the Cloudflare edge via the Cache API.
 * After the first request, subsequent requests for the same file are served
 * directly from the CDN — no Worker execution, no R2 fetch.
 */
import { Hono } from 'hono';

const files = new Hono();

const MIME_TYPES = {
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/mp4',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
};

files.get('/:folder/:filename', async (c) => {
    const folder = c.req.param('folder');
    const filename = c.req.param('filename');
    const r2Key = `${folder}/${filename}`;

    const ext = '.' + filename.split('.').pop().toLowerCase();
    const rangeHeader = c.req.header('Range');

    // Range requests bypass cache (needed for video/audio seeking)
    if (rangeHeader) {
        const object = await c.env.R2.get(r2Key, { range: c.req.raw.headers });
        if (!object) {
            return c.json({ error: 'File not found' }, 404);
        }

        const contentType = MIME_TYPES[ext] || object.httpMetadata?.contentType || 'application/octet-stream';
        const headers = {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
        };

        if (object.range) {
            const { offset, length } = object.range;
            headers['Content-Range'] = `bytes ${offset}-${offset + length - 1}/${object.size}`;
            headers['Content-Length'] = String(length);
        }

        return new Response(object.body, { status: 206, headers });
    }

    // --- Full-file requests: serve from edge cache when possible ---
    const cache = caches.default;
    const cacheKey = new Request(c.req.url, { method: 'GET' });

    // Check edge cache first
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
        return cachedResponse;
    }

    // Cache miss — fetch from R2
    const object = await c.env.R2.get(r2Key);
    if (!object) {
        return c.json({ error: 'File not found' }, 404);
    }

    const contentType = MIME_TYPES[ext] || object.httpMetadata?.contentType || 'application/octet-stream';

    const download = c.req.query('download') === '1';
    const disposition = download ? `attachment; filename="${filename}"` : 'inline';

    const response = new Response(object.body, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': disposition,
            'Content-Length': String(object.size),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });

    // Store in edge cache asynchronously (don't block the response)
    // Skip caching download requests since they're one-off
    if (!download) {
        c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
});

export default files;
