/**
 * User authentication middleware
 */
import { getCookie } from 'hono/cookie';

function extractToken(c) {
    const cookieToken = getCookie(c, 'session_token');
    if (cookieToken) return cookieToken;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);
    return null;
}

async function lookupSession(c, token) {
    // u.tier may not exist until migration 018 runs — fall back without it
    try {
        return await c.env.DB.prepare(`
            SELECT s.user_id, u.name, u.is_admin, u.tier
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > datetime('now')
        `).bind(token).first();
    } catch (e) {
        return await c.env.DB.prepare(`
            SELECT s.user_id, u.name, u.is_admin
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > datetime('now')
        `).bind(token).first();
    }
}

function toUser(session) {
    return {
        id: session.user_id,
        name: session.name,
        isAdmin: Boolean(session.is_admin),
        tier: session.tier || (session.is_admin ? 'admin' : 'member'),
    };
}

/**
 * Optional user authentication middleware
 * Sets c.user if a valid session token is provided, but does NOT reject unauthorized requests.
 * Use this on public routes that optionally show extra content for logged-in users.
 */
export async function optionalUserAuth(c, next) {
    const token = extractToken(c);
    if (token) {
        const session = await lookupSession(c, token);
        if (session) {
            c.set('user', toUser(session));
        }
    }
    await next();
}

/**
 * Required user authentication middleware
 * Rejects requests without a valid session token.
 */
export async function requireUserAuth(c, next) {
    const token = extractToken(c);
    if (!token) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const session = await lookupSession(c, token);
    if (!session) {
        return c.json({ error: 'Invalid or expired session' }, 401);
    }

    c.set('user', toUser(session));
    await next();
}
