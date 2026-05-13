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
    // Safari sends an initial "bytes=0-1" probe — must return exact 206 with Content-Range
    if (rangeHeader) {
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // Parse Range header explicitly (Safari compat — don't rely on R2 header extraction)
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (!match) {
            // Malformed range — fetch full object and return 200
            const object = await c.env.R2.get(r2Key);
            if (!object) return c.json({ error: 'File not found' }, 404);
            return new Response(object.body, {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': String(object.size),
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=31536000, immutable',
                },
            });
        }

        const rangeStart = parseInt(match[1]);
        const rangeEnd = match[2] ? parseInt(match[2]) : undefined;

        // Build explicit R2Range so response always has predictable fields
        const r2Range = { offset: rangeStart };
        if (rangeEnd !== undefined) {
            r2Range.length = rangeEnd - rangeStart + 1;
        }

        const object = await c.env.R2.get(r2Key, { range: r2Range });
        if (!object) return c.json({ error: 'File not found' }, 404);

        const totalSize = object.size;  // always full file size
        const actualEnd = rangeEnd !== undefined
            ? Math.min(rangeEnd, totalSize - 1)
            : totalSize - 1;
        const contentLength = actualEnd - rangeStart + 1;

        return new Response(object.body, {
            status: 206,
            headers: {
                'Content-Type': contentType,
                'Content-Range': `bytes ${rangeStart}-${actualEnd}/${totalSize}`,
                'Content-Length': String(contentLength),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
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
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const disposition = download ? `attachment; filename="${safeFilename}"` : 'inline';

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
