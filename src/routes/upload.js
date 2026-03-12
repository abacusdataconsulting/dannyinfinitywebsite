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
        extensions: ['.pdf'],
        maxSize: 50 * 1024 * 1024,
        label: 'PDF',
    },
    audio: {
        types: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/x-m4a'],
        extensions: ['.mp3', '.wav', '.flac', '.m4a'],
        maxSize: 100 * 1024 * 1024,
        label: 'audio',
    },
    images: {
        types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
        maxSize: 20 * 1024 * 1024,
        label: 'image',
    },
    videos: {
        types: ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/x-quicktime'],
        extensions: ['.mp4', '.webm', '.mov'],
        maxSize: 100 * 1024 * 1024, // Workers platform limit is 100MB
        label: 'video',
    },
};

// Map of extensions to the content type to store in R2
const EXTENSION_CONTENT_TYPES = {
    '.mov': 'video/mp4',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};

function sanitizeFilename(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9.\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100);
}

function getExtension(filename) {
    const dot = filename.lastIndexOf('.');
    return dot !== -1 ? filename.slice(dot).toLowerCase() : '';
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

    // Validate type — accept if MIME type matches OR file extension matches
    // (browsers report non-standard MIME types for many formats)
    const ext = getExtension(file.name);
    const typeOk = rules.types.includes(file.type) || rules.extensions.includes(ext);

    if (!typeOk) {
        return c.json({ error: `Invalid file type. Expected ${rules.label} (${rules.extensions.join(', ')})` }, 400);
    }

    // Validate size
    if (file.size > rules.maxSize) {
        const maxMB = Math.round(rules.maxSize / (1024 * 1024));
        return c.json({ error: `File too large. Max ${maxMB}MB for ${rules.label} files` }, 400);
    }

    const sanitized = sanitizeFilename(file.name);
    const r2Key = `${folder}/${Date.now()}-${sanitized}`;

    // Use a browser-compatible content type for storage
    // (e.g. store .mov as video/mp4 so browsers can play it)
    const contentType = EXTENSION_CONTENT_TYPES[ext] || file.type || 'application/octet-stream';

    // Convert File to ArrayBuffer for reliable R2 storage
    // (passing raw File objects can fail in some Workers runtime versions)
    try {
        const buffer = await file.arrayBuffer();
        await c.env.R2.put(r2Key, buffer, {
            httpMetadata: { contentType },
        });
    } catch (e) {
        return c.json({ error: `Upload to storage failed: ${e.message}` }, 500);
    }

    return c.json({
        success: true,
        r2Key,
        url: `/api/files/${r2Key}`,
    });
});

export default upload;
