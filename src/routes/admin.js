/**
 * Admin routes — visits, users, stats, user access management (all protected by adminAuth)
 */
import { Hono } from 'hono';
import { adminAuth } from '../middleware/auth.js';
import { hashPasswordPBKDF2 } from '../lib/crypto.js';

const admin = new Hono();

// Apply admin auth to all routes in this group
admin.use('*', adminAuth);

/**
 * GET /api/admin/visits — Paginated visits (auth visits + page views combined)
 */
admin.get('/visits', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    const visits = await c.env.DB.prepare(`
        SELECT
            visited_at, client_timestamp, name, login_type, device_type,
            os, os_version, browser, browser_version, browser_engine,
            city, region, country, ip_address, '/' as page_url, referrer
        FROM visits
        UNION ALL
        SELECT
            visited_at, NULL as client_timestamp, NULL as name, 'pageview' as login_type, device_type,
            os, NULL as os_version, browser, NULL as browser_version, NULL as browser_engine,
            city, region, country, ip_address, page_url, referrer
        FROM page_views
        ORDER BY visited_at DESC
        LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await c.env.DB.prepare(
        'SELECT (SELECT COUNT(*) FROM visits) + (SELECT COUNT(*) FROM page_views) as total'
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
            password_hash IS NOT NULL as has_password,
            source
        FROM users
        ORDER BY
            is_admin DESC,
            CASE WHEN source = 'admin' THEN 0 ELSE 1 END,
            last_seen DESC
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

    // Page view stats
    const totalPageViews = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM page_views'
    ).first();

    const pageViewsToday = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM page_views WHERE date(visited_at) = date('now')"
    ).first();

    const uniquePageSessions = await c.env.DB.prepare(
        'SELECT COUNT(DISTINCT session_id) as count FROM page_views WHERE session_id IS NOT NULL'
    ).first();

    const topPages = await c.env.DB.prepare(`
        SELECT page_url, COUNT(*) as count
        FROM page_views
        GROUP BY page_url
        ORDER BY count DESC
        LIMIT 10
    `).all();

    const topCountries = await c.env.DB.prepare(`
        SELECT country, COUNT(*) as count
        FROM page_views
        WHERE country IS NOT NULL
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
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
        totalPageViews: totalPageViews.count,
        pageViewsToday: pageViewsToday.count,
        uniquePageSessions: uniquePageSessions.count,
        topPages: topPages.results,
        topCountries: topCountries.results,
    });
});

/**
 * GET /api/admin/pageviews — Paginated page views
 */
admin.get('/pageviews', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');

    const pageviews = await c.env.DB.prepare(`
        SELECT *
        FROM page_views
        ORDER BY visited_at DESC
        LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await c.env.DB.prepare(
        'SELECT COUNT(*) as total FROM page_views'
    ).first();

    return c.json({
        pageviews: pageviews.results,
        total: countResult.total,
        hasMore: offset + pageviews.results.length < countResult.total,
        limit,
        offset,
    });
});

/**
 * GET /api/admin/donations — Paginated donation records with filtering
 * Query params: limit, offset, source (general|sheet), tip_type, sheet_music_id, search
 */
admin.get('/donations', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');
    const sourceFilter = c.req.query('source') || '';
    const tipTypeFilter = c.req.query('tip_type') || '';
    const sheetIdFilter = c.req.query('sheet_music_id') || '';
    const search = c.req.query('search') || '';

    let where = [];
    let binds = [];

    if (sourceFilter) {
        where.push('d.source = ?');
        binds.push(sourceFilter);
    }
    if (tipTypeFilter) {
        where.push('d.tip_type = ?');
        binds.push(tipTypeFilter);
    }
    if (sheetIdFilter) {
        where.push('d.sheet_music_id = ?');
        binds.push(parseInt(sheetIdFilter));
    }
    if (search) {
        where.push('(d.donor_name LIKE ? OR d.donor_email LIKE ? OR COALESCE(d.sheet_title, sm.title) LIKE ?)');
        const term = '%' + search + '%';
        binds.push(term, term, term);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const donations = await c.env.DB.prepare(`
        SELECT d.*, COALESCE(d.sheet_title, sm.title) as sheet_title
        FROM donations d
        LEFT JOIN sheet_music sm ON d.sheet_music_id = sm.id
        ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all();

    const countResult = await c.env.DB.prepare(
        `SELECT COUNT(*) as total FROM donations d
         LEFT JOIN sheet_music sm ON d.sheet_music_id = sm.id
         ${whereClause}`
    ).bind(...binds).first();

    return c.json({
        donations: donations.results,
        total: countResult.total,
        limit,
        offset,
    });
});

/**
 * GET /api/admin/donations/stats — Donation statistics with breakdowns
 */
admin.get('/donations/stats', async (c) => {
    const total = await c.env.DB.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM donations'
    ).first();

    const uniqueDonors = await c.env.DB.prepare(
        'SELECT COUNT(DISTINCT donor_email) as count FROM donations WHERE donor_email IS NOT NULL'
    ).first();

    const generalTips = await c.env.DB.prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM donations WHERE source = 'general' OR (source = 'unknown' AND sheet_music_id IS NULL)"
    ).first();

    const sheetTips = await c.env.DB.prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM donations WHERE source = 'sheet' OR (source = 'unknown' AND sheet_music_id IS NOT NULL)"
    ).first();

    const bySheet = await c.env.DB.prepare(`
        SELECT COALESCE(d.sheet_title, sm.title) as title, d.sheet_music_id,
               COUNT(*) as count, SUM(d.amount) as total_amount
        FROM donations d
        LEFT JOIN sheet_music sm ON d.sheet_music_id = sm.id
        WHERE d.sheet_music_id IS NOT NULL
        GROUP BY d.sheet_music_id
        ORDER BY total_amount DESC
    `).all();

    const byTipType = await c.env.DB.prepare(`
        SELECT tip_type, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
        FROM donations
        GROUP BY tip_type
        ORDER BY count DESC
    `).all();

    return c.json({
        totalDonations: total.count,
        totalAmount: total.total_amount,
        uniqueDonors: uniqueDonors.count,
        generalTips: { count: generalTips.count, amount: generalTips.total_amount },
        sheetTips: { count: sheetTips.count, amount: sheetTips.total_amount },
        bySheet: bySheet.results,
        byTipType: byTipType.results,
    });
});

/**
 * GET /api/admin/purchases — Paginated purchase records with filtering
 */
admin.get('/purchases', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');
    const sheetIdFilter = c.req.query('sheet_music_id') || '';
    const search = c.req.query('search') || '';

    let where = [];
    let binds = [];

    if (sheetIdFilter) {
        where.push('pi.sheet_music_id = ?');
        binds.push(parseInt(sheetIdFilter));
    }
    if (search) {
        where.push('(p.buyer_name LIKE ? OR p.buyer_email LIKE ?)');
        const term = '%' + search + '%';
        binds.push(term, term);
    }

    // If filtering by sheet, we need to join purchase_items
    const needsItemJoin = sheetIdFilter ? true : false;
    const joinClause = needsItemJoin ? 'JOIN purchase_items pi ON pi.purchase_id = p.id' : '';
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const purchases = await c.env.DB.prepare(`
        SELECT DISTINCT p.id, p.stripe_session_id, p.buyer_email, p.buyer_name,
               p.amount_total, p.currency, p.token_expires_at, p.created_at
        FROM purchases p
        ${joinClause}
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all();

    // Get items for each purchase
    const results = [];
    for (const p of purchases.results) {
        const items = await c.env.DB.prepare(`
            SELECT pi.price_cents, sm.title
            FROM purchase_items pi
            JOIN sheet_music sm ON pi.sheet_music_id = sm.id
            WHERE pi.purchase_id = ?
        `).bind(p.id).all();

        results.push({
            ...p,
            items: items.results
        });
    }

    const countResult = await c.env.DB.prepare(
        `SELECT COUNT(DISTINCT p.id) as total FROM purchases p ${joinClause} ${whereClause}`
    ).bind(...binds).first();

    return c.json({
        purchases: results,
        total: countResult.total,
        limit,
        offset,
    });
});

/**
 * GET /api/admin/purchases/stats — Sales statistics
 */
admin.get('/purchases/stats', async (c) => {
    const total = await c.env.DB.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(amount_total), 0) as total_amount FROM purchases'
    ).first();

    const uniqueBuyers = await c.env.DB.prepare(
        'SELECT COUNT(DISTINCT buyer_email) as count FROM purchases WHERE buyer_email IS NOT NULL'
    ).first();

    const bySheet = await c.env.DB.prepare(`
        SELECT sm.title, pi.sheet_music_id,
               COUNT(*) as units_sold, SUM(pi.price_cents) as total_revenue
        FROM purchase_items pi
        JOIN sheet_music sm ON pi.sheet_music_id = sm.id
        GROUP BY pi.sheet_music_id
        ORDER BY units_sold DESC
    `).all();

    return c.json({
        totalPurchases: total.count,
        totalRevenue: total.total_amount,
        uniqueBuyers: uniqueBuyers.count,
        bySheet: bySheet.results,
    });
});

// =========================================
// USER MANAGEMENT
// =========================================

/**
 * POST /api/admin/users/create — Create a new user account
 * Body: { name, password, isAdmin? }
 */
admin.post('/users/create', async (c) => {
    const body = await c.req.json();

    if (!body.name || body.name.trim().length < 2) {
        return c.json({ error: 'Name must be at least 2 characters' }, 400);
    }
    if (!body.password || body.password.length < 8) {
        return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const existing = await c.env.DB.prepare(
        'SELECT id FROM users WHERE name = ? COLLATE NOCASE'
    ).bind(body.name.trim()).first();

    if (existing) {
        return c.json({ error: 'User already exists' }, 409);
    }

    const { hash, salt } = await hashPasswordPBKDF2(body.password);

    const result = await c.env.DB.prepare(
        "INSERT INTO users (name, password_hash, password_salt, password_version, is_admin, source) VALUES (?, ?, ?, 2, ?, 'admin')"
    ).bind(body.name.trim(), hash, salt, body.isAdmin ? 1 : 0).run();

    return c.json({ success: true, userId: result.meta.last_row_id });
});

/**
 * PUT /api/admin/users/:id — Update a user (toggle admin, reset password)
 * Body: { isAdmin?, password? }
 */
admin.put('/users/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!user) return c.json({ error: 'User not found' }, 404);

    if (body.isAdmin !== undefined) {
        await c.env.DB.prepare(
            'UPDATE users SET is_admin = ? WHERE id = ?'
        ).bind(body.isAdmin ? 1 : 0, id).run();
    }

    if (body.password && body.password.length >= 8) {
        const { hash, salt } = await hashPasswordPBKDF2(body.password);
        await c.env.DB.prepare(
            'UPDATE users SET password_hash = ?, password_salt = ?, password_version = 2 WHERE id = ?'
        ).bind(hash, salt, id).run();

        // Revoke all sessions for this user (force re-login with new password)
        await c.env.DB.prepare(
            'DELETE FROM sessions WHERE user_id = ?'
        ).bind(id).run();
    }

    return c.json({ success: true });
});

/**
 * DELETE /api/admin/users/:id — Delete a user account
 */
admin.delete('/users/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const adminSession = c.get('adminSession');

    // Prevent self-deletion
    if (adminSession.user_id === id) {
        return c.json({ error: 'Cannot delete your own account' }, 400);
    }

    const user = await c.env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(id).first();
    if (!user) return c.json({ error: 'User not found' }, 404);

    // Delete/nullify related data
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM user_sheet_access WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('UPDATE visits SET user_id = NULL WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('UPDATE purchases SET user_id = NULL WHERE user_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return c.json({ success: true });
});

// =========================================
// USER CONTENT ACCESS MANAGEMENT
// =========================================

/**
 * GET /api/admin/user-access — List all access grants, optionally filtered
 * Query: userId?, sheetMusicId?
 */
admin.get('/user-access', async (c) => {
    const userId = c.req.query('userId');
    const sheetId = c.req.query('sheetMusicId');

    let where = [];
    let binds = [];

    if (userId) {
        where.push('usa.user_id = ?');
        binds.push(parseInt(userId));
    }
    if (sheetId) {
        where.push('usa.sheet_music_id = ?');
        binds.push(parseInt(sheetId));
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const result = await c.env.DB.prepare(`
        SELECT usa.id, usa.user_id, usa.sheet_music_id, usa.source, usa.created_at,
               u.name as user_name, sm.title as sheet_title
        FROM user_sheet_access usa
        JOIN users u ON usa.user_id = u.id
        JOIN sheet_music sm ON usa.sheet_music_id = sm.id
        ${whereClause}
        ORDER BY usa.created_at DESC
    `).bind(...binds).all();

    return c.json({ grants: result.results });
});

/**
 * POST /api/admin/user-access — Grant a user access to a sheet
 * Body: { userId, sheetMusicId }
 */
admin.post('/user-access', async (c) => {
    const body = await c.req.json();
    const adminSession = c.get('adminSession');

    if (!body.userId || !body.sheetMusicId) {
        return c.json({ error: 'userId and sheetMusicId are required' }, 400);
    }

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.userId).first();
    if (!user) return c.json({ error: 'User not found' }, 404);

    const sheet = await c.env.DB.prepare('SELECT id FROM sheet_music WHERE id = ?').bind(body.sheetMusicId).first();
    if (!sheet) return c.json({ error: 'Sheet not found' }, 404);

    try {
        await c.env.DB.prepare(
            "INSERT INTO user_sheet_access (user_id, sheet_music_id, source, granted_by) VALUES (?, ?, 'admin_grant', ?)"
        ).bind(body.userId, body.sheetMusicId, adminSession.user_id).run();
    } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
            return c.json({ error: 'User already has access to this sheet' }, 409);
        }
        throw e;
    }

    return c.json({ success: true });
});

/**
 * DELETE /api/admin/user-access/:id — Revoke an access grant
 */
admin.delete('/user-access/:id', async (c) => {
    const id = parseInt(c.req.param('id'));

    const grant = await c.env.DB.prepare('SELECT id FROM user_sheet_access WHERE id = ?').bind(id).first();
    if (!grant) return c.json({ error: 'Grant not found' }, 404);

    await c.env.DB.prepare('DELETE FROM user_sheet_access WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// =========================================
// CONTENT VIEWS
// =========================================

const CONTENT_TABLES = {
    album: 'albums',
    blog: 'blog_posts',
    sheet: 'sheet_music',
    video: 'videos',
    photo: 'photos',
};

/**
 * GET /api/admin/content-views — Overview of all content with view counts
 */
admin.get('/content-views', async (c) => {
    try {
        const typeFilter = c.req.query('type') || '';

        const queries = [];

        if (!typeFilter || typeFilter === 'album') {
            queries.push(`SELECT 'album' as type, a.id, a.title, a.show_views, a.is_published,
                (SELECT COUNT(*) FROM content_views cv WHERE cv.content_type = 'album' AND cv.content_id = a.id) as view_count
                FROM albums a`);
        }
        if (!typeFilter || typeFilter === 'blog') {
            queries.push(`SELECT 'blog' as type, b.id, b.title, b.show_views, b.is_published,
                (SELECT COUNT(*) FROM content_views cv WHERE cv.content_type = 'blog' AND cv.content_id = b.id) as view_count
                FROM blog_posts b`);
        }
        if (!typeFilter || typeFilter === 'sheet') {
            queries.push(`SELECT 'sheet' as type, s.id, s.title, s.show_views, s.is_published,
                (SELECT COUNT(*) FROM content_views cv WHERE cv.content_type = 'sheet' AND cv.content_id = s.id) as view_count
                FROM sheet_music s`);
        }
        if (!typeFilter || typeFilter === 'video') {
            queries.push(`SELECT 'video' as type, v.id, v.title, v.show_views, v.is_published,
                (SELECT COUNT(*) FROM content_views cv WHERE cv.content_type = 'video' AND cv.content_id = v.id) as view_count
                FROM videos v`);
        }
        if (!typeFilter || typeFilter === 'photo') {
            queries.push(`SELECT 'photo' as type, p.id, p.title, p.show_views, p.is_published,
                (SELECT COUNT(*) FROM content_views cv WHERE cv.content_type = 'photo' AND cv.content_id = p.id) as view_count
                FROM photos p`);
        }

        const sql = queries.join(' UNION ALL ') + ' ORDER BY view_count DESC';
        const result = await c.env.DB.prepare(sql).all();

        // Summary stats
        const totalViews = await c.env.DB.prepare('SELECT COUNT(*) as total FROM content_views').first();
        const todayViews = await c.env.DB.prepare(
            "SELECT COUNT(*) as total FROM content_views WHERE created_at >= date('now')"
        ).first();
        const weekViews = await c.env.DB.prepare(
            "SELECT COUNT(*) as total FROM content_views WHERE created_at >= date('now', '-7 days')"
        ).first();

        return c.json({
            items: result.results,
            stats: {
                total: totalViews.total,
                today: todayViews.total,
                week: weekViews.total,
            }
        });
    } catch (e) {
        return c.json({ items: [], stats: { total: 0, today: 0, week: 0 }, error: 'Migration not yet applied. Run migration 013-content-views.sql first.' });
    }
});

/**
 * GET /api/admin/content-views/:type/:id/timeline — Daily view counts (last 90 days)
 */
admin.get('/content-views/:type/:id/timeline', async (c) => {
    try {
        const type = c.req.param('type');
        const id = parseInt(c.req.param('id'));

        if (!CONTENT_TABLES[type]) return c.json({ error: 'Invalid type' }, 400);

        const result = await c.env.DB.prepare(`
            SELECT date(created_at) as day, COUNT(*) as count
            FROM content_views
            WHERE content_type = ? AND content_id = ?
            AND created_at >= date('now', '-90 days')
            GROUP BY date(created_at)
            ORDER BY day ASC
        `).bind(type, id).all();

        const total = await c.env.DB.prepare(
            'SELECT COUNT(*) as total FROM content_views WHERE content_type = ? AND content_id = ?'
        ).bind(type, id).first();

        return c.json({
            timeline: result.results,
            total: total.total,
        });
    } catch (e) {
        return c.json({ timeline: [], total: 0 });
    }
});

/**
 * PUT /api/admin/content-views/bulk-toggle — Toggle show_views for all items of a type (or all types)
 */
admin.put('/content-views/bulk-toggle', async (c) => {
    try {
        const body = await c.req.json();
        const { contentType, showViews } = body;
        const val = showViews ? 1 : 0;

        if (contentType && CONTENT_TABLES[contentType]) {
            await c.env.DB.prepare(
                `UPDATE ${CONTENT_TABLES[contentType]} SET show_views = ?`
            ).bind(val).run();
        } else {
            // All types
            await c.env.DB.batch([
                c.env.DB.prepare('UPDATE albums SET show_views = ?').bind(val),
                c.env.DB.prepare('UPDATE blog_posts SET show_views = ?').bind(val),
                c.env.DB.prepare('UPDATE sheet_music SET show_views = ?').bind(val),
                c.env.DB.prepare('UPDATE videos SET show_views = ?').bind(val),
                c.env.DB.prepare('UPDATE photos SET show_views = ?').bind(val),
            ]);
        }

        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: 'Migration not yet applied' }, 500);
    }
});

/**
 * PUT /api/admin/content-views/toggle — Toggle show_views for a content item
 */
admin.put('/content-views/toggle', async (c) => {
    try {
        const body = await c.req.json();
        const { contentType, contentId, showViews } = body;

        const table = CONTENT_TABLES[contentType];
        if (!table || !contentId) return c.json({ error: 'Invalid request' }, 400);

        await c.env.DB.prepare(
            `UPDATE ${table} SET show_views = ? WHERE id = ?`
        ).bind(showViews ? 1 : 0, parseInt(contentId)).run();

        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: 'Migration not yet applied' }, 500);
    }
});

export default admin;
