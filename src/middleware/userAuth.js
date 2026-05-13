/**
 * Optional user authentication middleware
 * Sets c.user if a valid session token is provided, but does NOT reject unauthorized requests.
 * Use this on public routes that optionally show extra content for logged-in users.
 */

export async function optionalUserAuth(c, next) {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const session = await c.env.DB.prepare(`
            SELECT s.user_id, u.name, u.is_admin
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > datetime('now')
        `).bind(token).first();

        if (session) {
            c.set('user', {
                id: session.user_id,
                name: session.name,
                isAdmin: Boolean(session.is_admin),
            });
        }
    }
    await next();
}

/**
 * Required user authentication middleware
 * Rejects requests without a valid session token.
 */
export async function requireUserAuth(c, next) {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const token = authHeader.substring(7);
    const session = await c.env.DB.prepare(`
        SELECT s.user_id, u.name, u.is_admin
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first();

    if (!session) {
        return c.json({ error: 'Invalid or expired session' }, 401);
    }

    c.set('user', {
        id: session.user_id,
        name: session.name,
        isAdmin: Boolean(session.is_admin),
    });
    await next();
}
