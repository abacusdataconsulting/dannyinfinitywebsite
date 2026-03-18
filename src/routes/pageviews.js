/**
 * Page-view tracking route — passive, no auth required
 */
import { Hono } from 'hono';

const pageviews = new Hono();

/**
 * POST /api/pageview — Log a page view
 */
pageviews.post('/', async (c) => {
    const body = await c.req.json();
    const request = c.req.raw;

    const ip = request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Forwarded-For')
        || 'unknown';
    const country = request.headers.get('CF-IPCountry') || null;
    const city = c.req.raw.cf?.city || null;
    const region = c.req.raw.cf?.region || null;

    await c.env.DB.prepare(`
        INSERT INTO page_views (
            session_id, page_url, referrer, ip_address, country, city, region,
            user_agent, device_type, os, browser, language,
            screen_width, screen_height
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        body.sessionId || null,
        body.pageUrl || '/',
        body.referrer || null,
        ip,
        country,
        city,
        region,
        body.userAgent || null,
        body.deviceType || null,
        body.os || null,
        body.browser || null,
        body.language || null,
        body.screenWidth || null,
        body.screenHeight || null,
    ).run();

    return c.json({ ok: true });
});

export default pageviews;
