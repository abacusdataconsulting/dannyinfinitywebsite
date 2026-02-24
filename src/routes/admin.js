/**
 * Admin routes — visits, users, stats (all protected by adminAuth)
 */
import { Hono } from 'hono';
import { adminAuth } from '../middleware/auth.js';

const admin = new Hono();

// Apply admin auth to all routes in this group
admin.use('*', adminAuth);

/**
 * GET /api/admin/visits — Paginated visits
 */
admin.get('/visits', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    const visits = await c.env.DB.prepare(`
        SELECT *
        FROM visits
        ORDER BY visited_at DESC
        LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await c.env.DB.prepare(
        'SELECT COUNT(*) as total FROM visits'
    ).first();

    return c.json({
        visits: visits.results,
        total: countResult.total,
        hasMore: offset + visits.results.length < countResult.total,
        limit,
        offset,
    });
});

/**
 * GET /api/admin/users — All users
 */
admin.get('/users', async (c) => {
    const users = await c.env.DB.prepare(`
        SELECT
            id, name, is_admin, created_at, last_seen,
            password_hash IS NOT NULL as has_password
        FROM users
        ORDER BY last_seen DESC
    `).all();

    return c.json({ users: users.results });
});

/**
 * GET /api/admin/stats — Dashboard statistics
 */
admin.get('/stats', async (c) => {
    const totalVisits = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM visits'
    ).first();

    const uniqueVisitors = await c.env.DB.prepare(
        'SELECT COUNT(DISTINCT ip_address) as count FROM visits'
    ).first();

    const totalUsers = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM users'
    ).first();

    const visitsToday = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM visits WHERE date(visited_at) = date('now')"
    ).first();

    const deviceStats = await c.env.DB.prepare(`
        SELECT device_type, COUNT(*) as count
        FROM visits
        WHERE device_type IS NOT NULL
        GROUP BY device_type
    `).all();

    const loginStats = await c.env.DB.prepare(`
        SELECT login_type, COUNT(*) as count
        FROM visits
        WHERE login_type IS NOT NULL
        GROUP BY login_type
    `).all();

    const osStats = await c.env.DB.prepare(`
        SELECT os, COUNT(*) as count
        FROM visits
        WHERE os IS NOT NULL
        GROUP BY os
        ORDER BY count DESC
        LIMIT 5
    `).all();

    const browserStats = await c.env.DB.prepare(`
        SELECT browser, COUNT(*) as count
        FROM visits
        WHERE browser IS NOT NULL
        GROUP BY browser
        ORDER BY count DESC
        LIMIT 5
    `).all();

    // Convert arrays to objects
    const deviceObj = {};
    deviceStats.results.forEach(d => { deviceObj[d.device_type] = d.count; });

    const loginObj = {};
    loginStats.results.forEach(l => { loginObj[l.login_type] = l.count; });

    return c.json({
        totalVisits: totalVisits.count,
        uniqueVisitors: uniqueVisitors.count,
        totalUsers: totalUsers.count,
        visitsToday: visitsToday.count,
        deviceStats: deviceObj,
        loginStats: loginObj,
        osStats: osStats.results,
        browserStats: browserStats.results,
    });
});

/**
 * GET /api/admin/donations — Paginated donation records
 */
admin.get('/donations', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    const donations = await c.env.DB.prepare(`
        SELECT d.*, sm.title as sheet_title
        FROM donations d
        LEFT JOIN sheet_music sm ON d.sheet_music_id = sm.id
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await c.env.DB.prepare(
        'SELECT COUNT(*) as total FROM donations'
    ).first();

    return c.json({
        donations: donations.results,
        total: countResult.total,
        limit,
        offset,
    });
});

/**
 * GET /api/admin/donations/stats — Donation statistics
 */
admin.get('/donations/stats', async (c) => {
    const total = await c.env.DB.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM donations'
    ).first();

    const uniqueDonors = await c.env.DB.prepare(
        'SELECT COUNT(DISTINCT donor_email) as count FROM donations WHERE donor_email IS NOT NULL'
    ).first();

    const bySheet = await c.env.DB.prepare(`
        SELECT sm.title, COUNT(*) as count, SUM(d.amount) as total_amount
        FROM donations d
        JOIN sheet_music sm ON d.sheet_music_id = sm.id
        GROUP BY d.sheet_music_id
        ORDER BY total_amount DESC
    `).all();

    return c.json({
        totalDonations: total.count,
        totalAmount: total.total_amount,
        uniqueDonors: uniqueDonors.count,
        bySheet: bySheet.results,
    });
});

export default admin;
