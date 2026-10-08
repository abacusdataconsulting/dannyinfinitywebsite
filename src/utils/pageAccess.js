/**
 * Page access helpers — per-page tier requirements and the anonymous
 * preview gate (viewers below the required tier see the first N items,
 * then a sign-in/upgrade prompt). Settings live in the page_access table.
 */
import { tierRank, requiredRank, TIER_RANK } from './tiers.js';

const DEFAULT_GATE = { required_level: 'public', gate_enabled: 0, anon_preview_count: 8 };

export async function getPageGate(db, page) {
    try {
        const row = await db.prepare(
            'SELECT page, required_level, gate_enabled, anon_preview_count FROM page_access WHERE page = ?'
        ).bind(page).first();
        return row || { page, ...DEFAULT_GATE };
    } catch (e) {
        // Migration not yet applied — everything stays public
        return { page, ...DEFAULT_GATE };
    }
}

/**
 * Limit a list according to the page's gate and the viewer's tier.
 * Returns { items, locked, total, previewCount, requiredLevel }:
 * - viewer meets the required level: full list (anonymous viewers on a
 *   public page still hit the preview gate when it's enabled)
 * - viewer below the required level: preview items if the gate is on,
 *   otherwise nothing
 */
export function applyAnonGate(items, gate, user) {
    const total = items.length;
    const level = gate.required_level || 'public';
    const meetsLevel = tierRank(user) >= requiredRank(level);
    const previewGated = !user && gate.gate_enabled; // preview gate applies to anonymous only

    if (meetsLevel && !previewGated) {
        return { items, locked: false, total, previewCount: null, requiredLevel: level };
    }

    const n = gate.gate_enabled ? Math.max(0, parseInt(gate.anon_preview_count) || 0) : 0;
    if (total > n) {
        return { items: items.slice(0, n), locked: true, total, previewCount: n, requiredLevel: level };
    }
    return { items, locked: false, total, previewCount: null, requiredLevel: level };
}

/**
 * Resolve the viewer behind a raw Request's session cookie.
 * Returns { rank, user } — rank is TIER_RANK.guest when anonymous.
 * Used by the worker fetch handler to gate whole HTML pages.
 */
export async function getRequestViewerRank(env, request) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/(?:^|;\s*)session_token=([^;]+)/);
    if (!match) return TIER_RANK.guest;
    try {
        let session;
        try {
            session = await env.DB.prepare(
                "SELECT u.is_admin, u.tier FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
            ).bind(match[1]).first();
        } catch (e) {
            session = await env.DB.prepare(
                "SELECT u.is_admin FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
            ).bind(match[1]).first();
        }
        if (!session) return TIER_RANK.guest;
        return tierRank({ tier: session.tier, isAdmin: Boolean(session.is_admin) });
    } catch (e) {
        return TIER_RANK.guest;
    }
}
