/**
 * Public streaming API — stream info, polled live chat, presence.
 * Chat transport is short-interval polling against D1 (no WebSockets):
 * the "new since id" query is a cheap indexed read and 3-5s latency is
 * invisible next to YouTube's own broadcast delay.
 */
import { Hono } from 'hono';
import { optionalUserAuth } from '../../middleware/userAuth.js';

const streaming = new Hono();
streaming.use('*', optionalUserAuth);

// Chat/presence responses must never be cached
streaming.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
});

const MAX_MESSAGE_LENGTH = 500;

async function getSettings(db) {
    const row = await db.prepare('SELECT * FROM stream_settings WHERE id = 1').first();
    return row || {
        mode: 'offline', video_id: null, channel_id: null, title: 'Live Stream',
        is_live: 0, offline_message: 'Stream is offline. Check back soon!',
        chat_enabled: 1, mute_notice_enabled: 0, hide_chat_when_offline: 0,
    };
}

/** Whether the chat panel should exist for viewers right now. */
function chatVisible(s) {
    if (!s.chat_enabled) return false;
    if (s.hide_chat_when_offline && s.mode === 'offline') return false;
    return true;
}

function clientIp(c) {
    return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
}

/**
 * Active ban/mute lookup for a username + IP. Returns the ban row or null.
 */
async function findBan(db, username, ip) {
    return await db.prepare(`
        SELECT type, expires_at FROM chat_bans
        WHERE (expires_at IS NULL OR expires_at > datetime('now'))
          AND ((target_type = 'user' AND value = ? COLLATE NOCASE)
            OR (target_type = 'ip' AND value = ?))
        LIMIT 1
    `).bind(username || '', ip).first();
}

/**
 * GET /api/streaming/info — stream settings + viewer identity
 */
streaming.get('/info', async (c) => {
    const s = await getSettings(c.env.DB);
    const user = c.get('user');

    return c.json({
        mode: s.mode,
        videoId: s.video_id || null,
        channelId: s.channel_id || null,
        title: s.title,
        isLive: Boolean(s.is_live),
        offlineMessage: s.offline_message,
        chatEnabled: Boolean(s.chat_enabled),
        chatVisible: chatVisible(s),
        loggedIn: Boolean(user),
        user: user ? { name: user.name, tier: user.tier } : null,
        isAdmin: Boolean(user && user.isAdmin),
    });
});

/**
 * GET /api/streaming/chat?since=<id>&limit=50
 * Cursor is the integer message id. since=0 returns the most recent
 * messages (reversed) so fresh visitors get recent history, not the
 * oldest page.
 */
streaming.get('/chat', async (c) => {
    const since = parseInt(c.req.query('since') || '0') || 0;
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50') || 50, 1), 100);

    let rows;
    if (since > 0) {
        const result = await c.env.DB.prepare(
            "SELECT id, author_name, tier, body, created_at FROM chat_messages WHERE status = 'visible' AND id > ? ORDER BY id ASC LIMIT ?"
        ).bind(since, limit).all();
        rows = result.results;
    } else {
        const result = await c.env.DB.prepare(
            "SELECT id, author_name, tier, body, created_at FROM chat_messages WHERE status = 'visible' ORDER BY id DESC LIMIT ?"
        ).bind(limit).all();
        rows = result.results.reverse();
    }

    const messages = rows.map(m => ({
        id: m.id,
        name: m.author_name,
        tier: m.tier,
        body: m.body,
        createdAt: m.created_at,
    }));

    const latestId = messages.length ? messages[messages.length - 1].id : since;
    return c.json({ messages, latestId });
});

/**
 * POST /api/streaming/chat — body { body }
 * Login required. Muted/banned users are silently dropped by default
 * (message saved as hidden so nobody else sees it, but the sender's UI
 * looks normal); the admin can switch on an explicit mute notice.
 */
streaming.post('/chat', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Sign in to chat', code: 'login_required' }, 401);
    }

    const s = await getSettings(c.env.DB);
    if (!chatVisible(s)) {
        return c.json({ error: 'Chat is currently disabled' }, 403);
    }

    let body;
    try {
        body = await c.req.json();
    } catch (e) {
        return c.json({ error: 'Invalid request' }, 400);
    }

    const text = String(body.body || '').trim();
    if (!text) return c.json({ error: 'Message is empty' }, 400);
    if (text.length > MAX_MESSAGE_LENGTH) {
        return c.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, 400);
    }

    // Banned-phrase filter (shared with comments)
    try {
        const phrases = await c.env.DB.prepare('SELECT phrase FROM banned_phrases').all();
        const lower = text.toLowerCase();
        for (const row of phrases.results) {
            if (row.phrase && lower.includes(String(row.phrase).toLowerCase())) {
                return c.json({ error: 'Message contains blocked content' }, 400);
            }
        }
    } catch (e) { /* banned_phrases table missing — skip */ }

    const ip = clientIp(c);
    const country = c.req.header('CF-IPCountry') || null;

    const ban = await findBan(c.env.DB, user.name, ip);
    if (ban) {
        if (s.mute_notice_enabled) {
            const until = ban.expires_at ? ' until ' + ban.expires_at + ' UTC' : '';
            return c.json({ error: 'You are muted' + until }, 403);
        }
        // Silent drop: store hidden so the sender's UI behaves normally but
        // the poll filter never serves it to anyone else. Doubles as an
        // evidence log for the admin.
        const result = await c.env.DB.prepare(
            "INSERT INTO chat_messages (user_id, author_name, tier, body, ip, country, status) VALUES (?, ?, ?, ?, ?, ?, 'hidden')"
        ).bind(user.id, user.name, user.tier || 'member', text, ip, country).run();
        return c.json({
            success: true,
            message: { id: result.meta.last_row_id, name: user.name, tier: user.tier || 'member', body: text, createdAt: new Date().toISOString() },
        }, 201);
    }

    const result = await c.env.DB.prepare(
        "INSERT INTO chat_messages (user_id, author_name, tier, body, ip, country, status) VALUES (?, ?, ?, ?, ?, ?, 'visible')"
    ).bind(user.id, user.name, user.tier || 'member', text, ip, country).run();

    // Probabilistic trim: keep the table bounded without a cron
    if (Math.random() < 0.02) {
        try {
            await c.env.DB.prepare(
                'DELETE FROM chat_messages WHERE id < (SELECT id FROM chat_messages ORDER BY id DESC LIMIT 1 OFFSET 5000)'
            ).run();
        } catch (e) { /* ignore */ }
    }

    return c.json({
        success: true,
        message: { id: result.meta.last_row_id, name: user.name, tier: user.tier || 'member', body: text, createdAt: new Date().toISOString() },
    }, 201);
});

/**
 * POST /api/streaming/heartbeat — body { guestId? }
 * Registers/refreshes the caller in the viewers table. Logged-in users key
 * by user id; guests by a client-generated uuid (sessionStorage).
 */
streaming.post('/heartbeat', async (c) => {
    const user = c.get('user');

    let guestId = null;
    try {
        const body = await c.req.json();
        guestId = body.guestId ? String(body.guestId) : null;
    } catch (e) { /* empty body is fine for logged-in users */ }

    let viewerKey;
    if (user) {
        viewerKey = 'u:' + user.id;
    } else {
        if (!guestId || guestId.length < 10 || guestId.length > 64 || !/^[A-Za-z0-9-]+$/.test(guestId)) {
            return c.json({ error: 'Invalid guest id' }, 400);
        }
        viewerKey = 'g:' + guestId;
    }

    const ip = clientIp(c);
    const country = c.req.header('CF-IPCountry') || null;
    const city = c.req.raw.cf?.city || null;

    await c.env.DB.prepare(`
        INSERT INTO stream_viewers (viewer_key, user_id, name, tier, country, city, ip, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(viewer_key) DO UPDATE SET
            user_id = excluded.user_id, name = excluded.name, tier = excluded.tier,
            country = excluded.country, city = excluded.city, ip = excluded.ip,
            last_seen = CURRENT_TIMESTAMP
    `).bind(
        viewerKey,
        user ? user.id : null,
        user ? user.name : null,
        user ? (user.tier || 'member') : 'guest',
        country, city, ip
    ).run();

    // Probabilistic pruning of stale viewers
    if (Math.random() < 0.1) {
        try {
            await c.env.DB.prepare(
                "DELETE FROM stream_viewers WHERE last_seen < datetime('now', '-5 minutes')"
            ).run();
        } catch (e) { /* ignore */ }
    }

    const count = await c.env.DB.prepare(
        "SELECT COUNT(*) as n FROM stream_viewers WHERE last_seen > datetime('now', '-60 seconds')"
    ).first();

    return c.json({ ok: true, viewerCount: count?.n || 0 });
});

/**
 * GET /api/streaming/viewers — who's watching.
 * Public payload shows name (null = Guest), tier, and country ONLY —
 * city and IP are admin-panel detail.
 */
streaming.get('/viewers', async (c) => {
    const result = await c.env.DB.prepare(`
        SELECT user_id, name, tier, country FROM stream_viewers
        WHERE last_seen > datetime('now', '-60 seconds')
        ORDER BY user_id IS NULL, name
        LIMIT 100
    `).all();

    const count = await c.env.DB.prepare(
        "SELECT COUNT(*) as n FROM stream_viewers WHERE last_seen > datetime('now', '-60 seconds')"
    ).first();

    return c.json({
        viewers: result.results.map(v => ({ name: v.name, tier: v.tier || 'guest', country: v.country })),
        total: count?.n || 0,
    });
});

export default streaming;
