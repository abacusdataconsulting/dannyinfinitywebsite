/**
 * File serving route — streams files from R2
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

    // Handle Range requests (required for video/audio seeking)
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

        // R2 returns range info on the object
        if (object.range) {
            const { offset, length } = object.range;
            headers['Content-Range'] = `bytes ${offset}-${offset + length - 1}/${object.size}`;
            headers['Content-Length'] = String(length);
        }

        return new Response(object.body, { status: 206, headers });
    }

    // Normal full-file request
    const object = await c.env.R2.get(r2Key);
    if (!object) {
        return c.json({ error: 'File not found' }, 404);
    }

    const contentType = MIME_TYPES[ext] || object.httpMetadata?.contentType || 'application/octet-stream';

    const download = c.req.query('download') === '1';
    const disposition = download ? `attachment; filename="${filename}"` : 'inline';

    return new Response(object.body, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': disposition,
            'Content-Length': String(object.size),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
});

export default files;
