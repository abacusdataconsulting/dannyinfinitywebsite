/**
 * File upload route — uploads files to R2
 */
import { Hono } from 'hono';
import { adminAuth } from '../middleware/auth.js';

const upload = new Hono();

upload.use('*', adminAuth);

const FOLDER_RULES = {
    sheets: {
        types: ['application/pdf'],
        maxSize: 50 * 1024 * 1024,
        label: 'PDF',
    },
    audio: {
        types: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/x-m4a'],
        maxSize: 100 * 1024 * 1024,
        label: 'audio',
    },
    images: {
        types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        maxSize: 20 * 1024 * 1024,
        label: 'image',
    },
    videos: {
        types: ['video/mp4', 'video/webm'],
        maxSize: 500 * 1024 * 1024,
        label: 'video',
    },
};

function sanitizeFilename(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9.\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100);
}

upload.post('/', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    const folder = body.folder;

    if (!file || !folder) {
        return c.json({ error: 'file and folder are required' }, 400);
    }

    const rules = FOLDER_RULES[folder];
    if (!rules) {
        return c.json({ error: `Invalid folder. Use: ${Object.keys(FOLDER_RULES).join(', ')}` }, 400);
    }

    // Validate type
    if (!rules.types.includes(file.type)) {
        return c.json({ error: `Invalid file type. Expected ${rules.label}: ${rules.types.join(', ')}` }, 400);
    }

    // Validate size
    if (file.size > rules.maxSize) {
        const maxMB = Math.round(rules.maxSize / (1024 * 1024));
        return c.json({ error: `File too large. Max ${maxMB}MB for ${rules.label} files` }, 400);
    }

    const sanitized = sanitizeFilename(file.name);
    const r2Key = `${folder}/${Date.now()}-${sanitized}`;

    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2.put(r2Key, arrayBuffer, {
        httpMetadata: { contentType: file.type },
    });

    return c.json({
        success: true,
        r2Key,
        url: `/api/files/${r2Key}`,
    });
});

export default upload;
