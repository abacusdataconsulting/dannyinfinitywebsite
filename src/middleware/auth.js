/**
 * Authentication middleware for admin routes
 */
import { getCookie } from 'hono/cookie';

function extractToken(c) {
    const cookieToken = getCookie(c, 'session_token');
    if (cookieToken) return cookieToken;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);
    return null;
}

export async function adminAuth(c, next) {
    const token = extractToken(c);
    if (!token) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const session = await c.env.DB.prepare(`
        SELECT s.*, u.is_admin
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first();

    if (!session || !session.is_admin) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    c.set('adminSession', session);
    await next();
}
