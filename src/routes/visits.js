/**
 * Visit routes — log visits
 */
import { Hono } from 'hono';

const visits = new Hono();

/**
 * POST /api/visit — Log a visit
 */
visits.post('/', async (c) => {
    const body = await c.req.json();
    const request = c.req.raw;

    // Get client info from Cloudflare headers
    const ip = request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Forwarded-For')
        || 'unknown';
    const country = request.headers.get('CF-IPCountry') || null;
    const city = c.req.raw.cf?.city || null;
    const region = c.req.raw.cf?.region || null;

    // Check if user exists
    let userId = null;
    if (body.name) {
        const user = await c.env.DB.prepare(
            'SELECT id FROM users WHERE name = ? COLLATE NOCASE'
        ).bind(body.name).first();

        if (user) {
            userId = user.id;
            await c.env.DB.prepare(
                'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(userId).run();
        }
    }

    const result = await c.env.DB.prepare(`
        INSERT INTO visits (
            user_id, name, login_type, ip_address, country, city, region,
            user_agent, device_type, os, os_version, browser, browser_version, browser_engine,
            language, screen_width, screen_height, window_width, window_height,
            timezone, referrer, client_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        userId,
        body.name || null,
        body.loginType || null,
        ip,
        country,
        city,
        region,
        body.userAgent || null,
        body.deviceType || null,
        body.os || null,
        body.osVersion || null,
        body.browser || null,
        body.browserVersion || null,
        body.browserEngine || null,
        body.language || null,
        body.screenWidth || null,
        body.screenHeight || null,
        body.windowWidth || null,
        body.windowHeight || null,
        body.timezone || null,
        body.referrer || null,
        body.clientTimestamp || null
    ).run();

    return c.json({
        success: true,
        visitId: result.meta.last_row_id,
        recognized: userId !== null,
    });
});

export default visits;
