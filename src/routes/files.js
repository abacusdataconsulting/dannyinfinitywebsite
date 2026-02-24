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

    const object = await c.env.R2.get(r2Key);
    if (!object) {
        return c.json({ error: 'File not found' }, 404);
    }

    const ext = '.' + filename.split('.').pop().toLowerCase();
    const contentType = object.httpMetadata?.contentType || MIME_TYPES[ext] || 'application/octet-stream';

    const download = c.req.query('download') === '1';
    const disposition = download ? `attachment; filename="${filename}"` : 'inline';

    return new Response(object.body, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': disposition,
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
});

export default files;
