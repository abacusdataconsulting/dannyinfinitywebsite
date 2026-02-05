/**
 * Abacus API - Cloudflare Worker
 * Handles user recognition, visit tracking, and authentication
 */

// CORS headers for local development
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper: JSON response
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

// Helper: Error response
function errorResponse(message, status = 400) {
    return jsonResponse({ error: message }, status);
}

// Helper: Simple hash function (use proper crypto in production)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Generate session token
function generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Get client info from Cloudflare headers
function getClientInfo(request) {
    return {
        ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown',
        country: request.headers.get('CF-IPCountry') || null,
        city: request.cf?.city || null,
        region: request.cf?.region || null,
    };
}

// Helper: Verify admin authentication
async function verifyAdmin(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);

    const session = await env.DB.prepare(`
        SELECT s.*, u.is_admin
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first();

    if (!session || !session.is_admin) {
        return null;
    }

    return session;
}

// ============================================
// API Routes
// ============================================

/**
 * POST /api/visit - Log a visit
 */
async function handleVisit(request, env) {
    try {
        const body = await request.json();
        const clientInfo = getClientInfo(request);

        // Check if user exists
        let userId = null;
        if (body.name) {
            const user = await env.DB.prepare(
                'SELECT id FROM users WHERE name = ? COLLATE NOCASE'
            ).bind(body.name).first();

            if (user) {
                userId = user.id;
                // Update last seen
                await env.DB.prepare(
                    'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?'
                ).bind(userId).run();
            }
        }

        // Insert visit record
        const result = await env.DB.prepare(`
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
            clientInfo.ip,
            clientInfo.country,
            clientInfo.city,
            clientInfo.region,
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

        return jsonResponse({
            success: true,
            visitId: result.meta.last_row_id,
            recognized: userId !== null,
        });
    } catch (error) {
        console.error('Visit error:', error);
        return errorResponse('Failed to log visit', 500);
    }
}

/**
 * GET /api/user/check/:name - Check if user exists
 */
async function handleUserCheck(name, env) {
    try {
        const user = await env.DB.prepare(
            'SELECT id, name, password_hash IS NOT NULL as has_password FROM users WHERE name = ? COLLATE NOCASE'
        ).bind(name).first();

        if (user) {
            return jsonResponse({
                recognized: true,
                name: user.name,
                hasPassword: Boolean(user.has_password),
            });
        }

        return jsonResponse({
            recognized: false,
        });
    } catch (error) {
        console.error('User check error:', error);
        return errorResponse('Failed to check user', 500);
    }
}

/**
 * POST /api/user/register - Register a new user
 */
async function handleUserRegister(request, env) {
    try {
        const body = await request.json();

        if (!body.name || body.name.trim().length < 2) {
            return errorResponse('Name must be at least 2 characters');
        }

        // Check if user already exists
        const existing = await env.DB.prepare(
            'SELECT id FROM users WHERE name = ? COLLATE NOCASE'
        ).bind(body.name.trim()).first();

        if (existing) {
            return errorResponse('User already exists', 409);
        }

        // Hash password if provided
        let passwordHash = null;
        if (body.password) {
            passwordHash = await hashPassword(body.password);
        }

        // Insert user
        const result = await env.DB.prepare(
            'INSERT INTO users (name, password_hash) VALUES (?, ?)'
        ).bind(body.name.trim(), passwordHash).run();

        return jsonResponse({
            success: true,
            userId: result.meta.last_row_id,
            message: 'User registered successfully',
        });
    } catch (error) {
        console.error('Register error:', error);
        return errorResponse('Failed to register user', 500);
    }
}

/**
 * POST /api/user/login - Authenticate user
 */
async function handleUserLogin(request, env) {
    try {
        const body = await request.json();

        if (!body.name) {
            return errorResponse('Name is required');
        }

        const user = await env.DB.prepare(
            'SELECT id, name, password_hash, is_admin FROM users WHERE name = ? COLLATE NOCASE'
        ).bind(body.name).first();

        if (!user) {
            return errorResponse('User not found', 404);
        }

        // If user has password, validate it
        if (user.password_hash) {
            if (!body.password) {
                return errorResponse('Password required', 401);
            }

            const inputHash = await hashPassword(body.password);
            if (inputHash !== user.password_hash) {
                return errorResponse('Invalid password', 401);
            }
        }

        // Generate session token
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await env.DB.prepare(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
        ).bind(user.id, token, expiresAt.toISOString()).run();

        // Update last seen
        await env.DB.prepare(
            'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(user.id).run();

        return jsonResponse({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                isAdmin: Boolean(user.is_admin),
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse('Failed to login', 500);
    }
}

/**
 * GET /api/visits - Get visit history (admin only)
 */
async function handleGetVisits(request, env) {
    try {
        // TODO: Add admin authentication check
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const visits = await env.DB.prepare(`
            SELECT
                v.*,
                u.name as user_name
            FROM visits v
            LEFT JOIN users u ON v.user_id = u.id
            ORDER BY v.visited_at DESC
            LIMIT ? OFFSET ?
        `).bind(limit, offset).all();

        const countResult = await env.DB.prepare(
            'SELECT COUNT(*) as total FROM visits'
        ).first();

        return jsonResponse({
            visits: visits.results,
            total: countResult.total,
            limit,
            offset,
        });
    } catch (error) {
        console.error('Get visits error:', error);
        return errorResponse('Failed to get visits', 500);
    }
}

/**
 * GET /api/users - Get all users (admin only)
 */
async function handleGetUsers(request, env) {
    try {
        // TODO: Add admin authentication check
        const users = await env.DB.prepare(`
            SELECT
                id, name, is_admin, created_at, last_seen,
                password_hash IS NOT NULL as has_password
            FROM users
            ORDER BY last_seen DESC
        `).all();

        return jsonResponse({
            users: users.results,
        });
    } catch (error) {
        console.error('Get users error:', error);
        return errorResponse('Failed to get users', 500);
    }
}

// ============================================
// Admin API Routes (Protected)
// ============================================

/**
 * GET /api/admin/visits - Get paginated visits (admin only)
 */
async function handleAdminGetVisits(request, env) {
    // Verify admin
    const admin = await verifyAdmin(request, env);
    if (!admin) {
        return errorResponse('Unauthorized', 401);
    }

    try {
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const visits = await env.DB.prepare(`
            SELECT *
            FROM visits
            ORDER BY visited_at DESC
            LIMIT ? OFFSET ?
        `).bind(limit, offset).all();

        const countResult = await env.DB.prepare(
            'SELECT COUNT(*) as total FROM visits'
        ).first();

        return jsonResponse({
            visits: visits.results,
            total: countResult.total,
            hasMore: offset + visits.results.length < countResult.total,
            limit,
            offset,
        });
    } catch (error) {
        console.error('Admin get visits error:', error);
        return errorResponse('Failed to get visits', 500);
    }
}

/**
 * GET /api/admin/users - Get all users (admin only)
 */
async function handleAdminGetUsers(request, env) {
    // Verify admin
    const admin = await verifyAdmin(request, env);
    if (!admin) {
        return errorResponse('Unauthorized', 401);
    }

    try {
        const users = await env.DB.prepare(`
            SELECT
                id, name, is_admin, created_at, last_seen,
                password_hash IS NOT NULL as has_password
            FROM users
            ORDER BY last_seen DESC
        `).all();

        return jsonResponse({
            users: users.results,
        });
    } catch (error) {
        console.error('Admin get users error:', error);
        return errorResponse('Failed to get users', 500);
    }
}

/**
 * GET /api/admin/stats - Get dashboard statistics (admin only)
 */
async function handleAdminGetStats(request, env) {
    // Verify admin
    const admin = await verifyAdmin(request, env);
    if (!admin) {
        return errorResponse('Unauthorized', 401);
    }

    try {
        // Total visits
        const totalVisits = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM visits'
        ).first();

        // Unique visitors (by IP)
        const uniqueVisitors = await env.DB.prepare(
            'SELECT COUNT(DISTINCT ip_address) as count FROM visits'
        ).first();

        // Total users
        const totalUsers = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM users'
        ).first();

        // Visits today
        const visitsToday = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM visits WHERE date(visited_at) = date('now')"
        ).first();

        // Device stats
        const deviceStats = await env.DB.prepare(`
            SELECT device_type, COUNT(*) as count
            FROM visits
            WHERE device_type IS NOT NULL
            GROUP BY device_type
        `).all();

        // Login type stats
        const loginStats = await env.DB.prepare(`
            SELECT login_type, COUNT(*) as count
            FROM visits
            WHERE login_type IS NOT NULL
            GROUP BY login_type
        `).all();

        // OS stats
        const osStats = await env.DB.prepare(`
            SELECT os, COUNT(*) as count
            FROM visits
            WHERE os IS NOT NULL
            GROUP BY os
            ORDER BY count DESC
            LIMIT 5
        `).all();

        // Browser stats
        const browserStats = await env.DB.prepare(`
            SELECT browser, COUNT(*) as count
            FROM visits
            WHERE browser IS NOT NULL
            GROUP BY browser
            ORDER BY count DESC
            LIMIT 5
        `).all();

        // Convert arrays to objects
        const deviceObj = {};
        deviceStats.results.forEach(d => {
            deviceObj[d.device_type] = d.count;
        });

        const loginObj = {};
        loginStats.results.forEach(l => {
            loginObj[l.login_type] = l.count;
        });

        return jsonResponse({
            totalVisits: totalVisits.count,
            uniqueVisitors: uniqueVisitors.count,
            totalUsers: totalUsers.count,
            visitsToday: visitsToday.count,
            deviceStats: deviceObj,
            loginStats: loginObj,
            osStats: osStats.results,
            browserStats: browserStats.results,
        });
    } catch (error) {
        console.error('Admin get stats error:', error);
        return errorResponse('Failed to get stats', 500);
    }
}

// ============================================
// Main Request Handler
// ============================================

export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        try {
            // API Routes
            if (path === '/api/visit' && method === 'POST') {
                return handleVisit(request, env);
            }

            if (path.startsWith('/api/user/check/') && method === 'GET') {
                const name = decodeURIComponent(path.split('/').pop());
                return handleUserCheck(name, env);
            }

            if (path === '/api/user/register' && method === 'POST') {
                return handleUserRegister(request, env);
            }

            if (path === '/api/user/login' && method === 'POST') {
                return handleUserLogin(request, env);
            }

            if (path === '/api/visits' && method === 'GET') {
                return handleGetVisits(request, env);
            }

            if (path === '/api/users' && method === 'GET') {
                return handleGetUsers(request, env);
            }

            // Admin routes
            if (path === '/api/admin/visits' && method === 'GET') {
                return handleAdminGetVisits(request, env);
            }

            if (path === '/api/admin/users' && method === 'GET') {
                return handleAdminGetUsers(request, env);
            }

            if (path === '/api/admin/stats' && method === 'GET') {
                return handleAdminGetStats(request, env);
            }

            // Health check
            if (path === '/api/health') {
                return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
            }

            // 404 for unknown routes
            return errorResponse('Not found', 404);

        } catch (error) {
            console.error('Unhandled error:', error);
            return errorResponse('Internal server error', 500);
        }
    },
};
