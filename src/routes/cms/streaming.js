/**
 * Streaming CMS routes — stream settings, chat moderation, bans, viewers
 */
import { Hono } from 'hono';
import { adminAuth } from '../../middleware/auth.js';

const streaming = new Hono();
streaming.use('*', adminAuth);

const MODES = ['video', 'channel_live', 'offline'];
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{10,}$/;

// ---- Settings ----

streaming.get('/settings', async (c) => {
    const settings = await c.env.DB.prepare('SELECT * FROM stream_settings WHERE id = 1').first();
    return c.json({ settings });
});

streaming.put('/settings', async (c) => {
    const body = await c.req.json();

    const existing = await c.env.DB.prepare('SELECT * FROM stream_settings WHERE id = 1').first();
    if (!existing) return c.json({ error: 'stream_settings missing — run migration 018' }, 500);

    const mode = body.mode !== undefined ? String(body.mode) : existing.mode;
    if (!MODES.includes(mode)) return c.json({ error: 'Invalid mode' }, 400);

    const videoId = body.videoId !== undefined ? (String(body.videoId).trim() || null) : existing.video_id;
    if (videoId && !VIDEO_ID_RE.test(videoId)) {
        return c.json({ error: 'Invalid YouTube video ID' }, 400);
    }

    const channelId = body.channelId !== undefined ? (String(body.channelId).trim() || null) : existing.channel_id;
    if (channelId && !CHANNEL_ID_RE.test(channelId)) {
        return c.json({ error: 'Invalid YouTube channel ID (starts with UC...)' }, 400);
    }

    if (mode === 'video' && !videoId) return c.json({ error: 'Video mode needs a video ID' }, 400);
    if (mode === 'channel_live' && !channelId) return c.json({ error: 'Channel-live mode needs a channel ID' }, 400);

    const title = body.title !== undefined ? (String(body.title).trim().slice(0, 200) || 'Live Stream') : existing.title;
    const offlineMessage = body.offlineMessage !== undefined
        ? (String(body.offlineMessage).trim().slice(0, 500) || 'Stream is offline. Check back soon!')
        : existing.offline_message;

    await c.env.DB.prepare(`
        UPDATE stream_settings SET
            mode = ?, video_id = ?, channel_id = ?, title = ?, is_live = ?,
            offline_message = ?, chat_enabled = ?, mute_notice_enabled = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    `).bind(
        mode, videoId, channelId, title,
        body.isLive !== undefined ? (body.isLive ? 1 : 0) : existing.is_live,
        offlineMessage,
        body.chatEnabled !== undefined ? (body.chatEnabled ? 1 : 0) : existing.chat_enabled,
        body.muteNoticeEnabled !== undefined ? (body.muteNoticeEnabled ? 1 : 0) : existing.mute_notice_enabled
    ).run();

    const settings = await c.env.DB.prepare('SELECT * FROM stream_settings WHERE id = 1').first();
    return c.json({ success: true, settings });
});

// ---- Chat moderation ----

streaming.get('/chat', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '100') || 100, 500);
    const offset = parseInt(c.req.query('offset') || '0') || 0;
    const status = c.req.query('status'); // 'visible' | 'hidden' | undefined = all

    let query = 'SELECT * FROM chat_messages';
    const binds = [];
    if (status === 'visible' || status === 'hidden') {
        query += ' WHERE status = ?';
        binds.push(status);
    }
    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    binds.push(limit, offset);

    const result = await c.env.DB.prepare(query).bind(...binds).all();
    const count = await c.env.DB.prepare('SELECT COUNT(*) as n FROM chat_messages').first();

    return c.json({ messages: result.results, total: count?.n || 0 });
});

streaming.put('/chat/:id/hide', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare("UPDATE chat_messages SET status = 'hidden' WHERE id = ?").bind(id).run();
    return c.json({ success: true });
});

streaming.put('/chat/:id/show', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare("UPDATE chat_messages SET status = 'visible' WHERE id = ?").bind(id).run();
    return c.json({ success: true });
});

streaming.delete('/chat/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM chat_messages WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

streaming.post('/chat/clear', async (c) => {
    await c.env.DB.prepare('DELETE FROM chat_messages').run();
    return c.json({ success: true });
});

// ---- Bans / mutes ----

streaming.get('/bans', async (c) => {
    const result = await c.env.DB.prepare(`
        SELECT b.*, u.name as created_by_name,
            CASE WHEN b.expires_at IS NOT NULL AND b.expires_at <= datetime('now') THEN 1 ELSE 0 END as is_expired
        FROM chat_bans b
        LEFT JOIN users u ON b.created_by = u.id
        ORDER BY b.created_at DESC
    `).all();
    return c.json({ bans: result.results });
});

streaming.post('/bans', async (c) => {
    const body = await c.req.json();
    const adminSession = c.get('adminSession');

    const targetType = String(body.targetType || '');
    if (targetType !== 'user' && targetType !== 'ip') {
        return c.json({ error: 'targetType must be "user" or "ip"' }, 400);
    }

    const value = String(body.value || '').trim();
    if (!value || value.length > 100) return c.json({ error: 'A target value is required' }, 400);

    const type = String(body.type || '');
    if (type !== 'mute' && type !== 'ban') {
        return c.json({ error: 'type must be "mute" or "ban"' }, 400);
    }

    let expiresAt = null;
    if (body.durationMinutes != null && body.durationMinutes !== '') {
        const minutes = parseInt(body.durationMinutes);
        if (isNaN(minutes) || minutes < 1) return c.json({ error: 'Invalid duration' }, 400);
        expiresAt = `+${minutes} minutes`;
    }

    const reason = body.reason ? String(body.reason).slice(0, 300) : null;

    if (expiresAt) {
        await c.env.DB.prepare(`
            INSERT INTO chat_bans (target_type, value, type, reason, expires_at, created_by)
            VALUES (?, ?, ?, ?, datetime('now', ?), ?)
        `).bind(targetType, value, type, reason, expiresAt, adminSession.user_id).run();
    } else {
        await c.env.DB.prepare(`
            INSERT INTO chat_bans (target_type, value, type, reason, expires_at, created_by)
            VALUES (?, ?, ?, ?, NULL, ?)
        `).bind(targetType, value, type, reason, adminSession.user_id).run();
    }

    return c.json({ success: true });
});

streaming.delete('/bans/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM chat_bans WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// ---- Viewers (full detail incl. city + IP) ----

streaming.get('/viewers', async (c) => {
    const result = await c.env.DB.prepare(`
        SELECT viewer_key, user_id, name, tier, country, city, ip, last_seen
        FROM stream_viewers
        WHERE last_seen > datetime('now', '-60 seconds')
        ORDER BY user_id IS NULL, name
        LIMIT 500
    `).all();
    return c.json({ viewers: result.results, total: result.results.length });
});

export default streaming;
