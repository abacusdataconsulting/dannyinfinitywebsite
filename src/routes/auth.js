/**
 * Auth routes — user check, register, login
 */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { hashPasswordPBKDF2, verifyPassword, generateToken } from '../lib/crypto.js';

function extractToken(c) {
    const cookieToken = getCookie(c, 'session_token');
    if (cookieToken) return cookieToken;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);
    return null;
}

function setSessionCookie(c, token) {
    setCookie(c, 'session_token', token, {
        httpOnly: true,
        secure: c.env.ENVIRONMENT === 'production',
        sameSite: 'Lax',
        path: '/api',
        maxAge: 7 * 24 * 60 * 60,
    });
}

function clearSessionCookie(c) {
    deleteCookie(c, 'session_token', { path: '/api' });
}

const auth = new Hono();

/**
 * GET /api/user/check/:name — Check if user exists
 */
auth.get('/check/:name', async (c) => {
    const name = decodeURIComponent(c.req.param('name'));

    const user = await c.env.DB.prepare(
        'SELECT id, name, password_hash IS NOT NULL as has_password FROM users WHERE name = ? COLLATE NOCASE'
    ).bind(name).first();

    if (user) {
        return c.json({
            recognized: true,
            name: user.name,
            hasPassword: true,
        });
    }

    // Uniform response shape to prevent enumeration
    return c.json({ recognized: false, name: '', hasPassword: false });
});

/**
 * POST /api/user/register — Register a new user
 */
auth.post('/register', async (c) => {
    const body = await c.req.json();

    if (!body.name || body.name.trim().length < 2) {
        return c.json({ error: 'Name must be at least 2 characters' }, 400);
    }

    // Check if user already exists
    const existing = await c.env.DB.prepare(
        'SELECT id FROM users WHERE name = ? COLLATE NOCASE'
    ).bind(body.name.trim()).first();

    if (existing) {
        return c.json({ error: 'User already exists' }, 409);
    }

    if (!body.password || body.password.length < 8) {
        return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const { hash: passwordHash, salt: passwordSalt } = await hashPasswordPBKDF2(body.password);
    const passwordVersion = 2;

    const result = await c.env.DB.prepare(
        'INSERT INTO users (name, password_hash, password_salt, password_version) VALUES (?, ?, ?, ?)'
    ).bind(body.name.trim(), passwordHash, passwordSalt, passwordVersion).run();

    return c.json({
        success: true,
        userId: result.meta.last_row_id,
        message: 'User registered successfully',
    });
});

/**
 * POST /api/user/login — Authenticate user
 */
auth.post('/login', async (c) => {
    const body = await c.req.json();

    if (!body.name) {
        return c.json({ error: 'Name is required' }, 400);
    }

    const user = await c.env.DB.prepare(
        'SELECT id, name, password_hash, password_salt, password_version, is_admin FROM users WHERE name = ? COLLATE NOCASE'
    ).bind(body.name).first();

    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    // Require password for all accounts
    if (!user.password_hash) {
        return c.json({ error: 'Account requires a password. Please contact the administrator.' }, 401);
    }

    if (!body.password) {
        return c.json({ error: 'Password required' }, 401);
    }

    const valid = await verifyPassword(
        body.password,
        user.password_hash,
        user.password_salt,
        user.password_version
    );

    if (!valid) {
        return c.json({ error: 'Invalid password' }, 401);
    }

    // Transparent migration: upgrade legacy SHA-256 to PBKDF2
    if (!user.password_version || user.password_version < 2) {
        const upgraded = await hashPasswordPBKDF2(body.password);
        await c.env.DB.prepare(
            'UPDATE users SET password_hash = ?, password_salt = ?, password_version = 2 WHERE id = ?'
        ).bind(upgraded.hash, upgraded.salt, user.id).run();
    }

    // Generate session token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await c.env.DB.prepare(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt.toISOString()).run();

    // Update last seen
    await c.env.DB.prepare(
        'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run();

    // Set httpOnly session cookie (not accessible to JavaScript)
    setSessionCookie(c, token);

    return c.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            isAdmin: Boolean(user.is_admin),
        },
    });
});

/**
 * POST /api/user/logout — Revoke session token
 */
auth.post('/logout', async (c) => {
    const token = extractToken(c);
    if (token) {
        await c.env.DB.prepare(
            'DELETE FROM sessions WHERE token = ?'
        ).bind(token).run();
    }
    clearSessionCookie(c);
    return c.json({ success: true });
});

/**
 * POST /api/user/change-password — Change own password (requires valid session)
 * Body: { currentPassword, newPassword }
 */
auth.post('/change-password', async (c) => {
    const token = extractToken(c);
    if (!token) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const session = await c.env.DB.prepare(`
        SELECT s.user_id, u.name, u.password_hash, u.password_salt, u.password_version
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first();

    if (!session) {
        return c.json({ error: 'Invalid or expired session' }, 401);
    }

    const body = await c.req.json();

    if (!body.currentPassword) {
        return c.json({ error: 'Current password is required' }, 400);
    }
    if (!body.newPassword || body.newPassword.length < 8) {
        return c.json({ error: 'New password must be at least 8 characters' }, 400);
    }

    // Verify current password
    const valid = await verifyPassword(
        body.currentPassword,
        session.password_hash,
        session.password_salt,
        session.password_version
    );

    if (!valid) {
        return c.json({ error: 'Current password is incorrect' }, 401);
    }

    // Hash new password
    const { hash, salt } = await hashPasswordPBKDF2(body.newPassword);
    await c.env.DB.prepare(
        'UPDATE users SET password_hash = ?, password_salt = ?, password_version = 2 WHERE id = ?'
    ).bind(hash, salt, session.user_id).run();

    // Revoke all existing sessions for this user (force re-login)
    await c.env.DB.prepare(
        'DELETE FROM sessions WHERE user_id = ?'
    ).bind(session.user_id).run();

    clearSessionCookie(c);
    return c.json({ success: true });
});

export default auth;
