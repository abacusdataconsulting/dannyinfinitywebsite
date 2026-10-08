/**
 * Membership tier hierarchy: guest < member < subscriber < vip < admin < super_admin
 * - guest: not signed in (or the passwordless seeded guest user)
 * - member: any registered account (default)
 * - subscriber / vip: assigned by an admin
 * - admin / super_admin: site staff; tier assignment of these is restricted
 *   to super admins. is_admin stays the operational admin flag and is kept
 *   in sync when an admin tier is granted or revoked.
 */

export const TIER_RANK = {
    guest: 0,
    member: 1,
    subscriber: 2,
    vip: 3,
    admin: 4,
    super_admin: 5,
};

export const ASSIGNABLE_TIERS = ['member', 'subscriber', 'vip', 'admin', 'super_admin'];

/** Rank for a viewer object ({ tier, isAdmin } or null/undefined for anonymous). */
export function tierRank(user) {
    if (!user) return TIER_RANK.guest;
    const rank = TIER_RANK[user.tier] ?? TIER_RANK.member;
    // An is_admin account always ranks at least 'admin' even if tier is stale
    if (user.isAdmin && rank < TIER_RANK.admin) return TIER_RANK.admin;
    return rank;
}

/** Rank required by a page_access level ('public' | 'logged_in' | tier name). */
export function requiredRank(level) {
    if (!level || level === 'public') return TIER_RANK.guest;
    if (level === 'logged_in') return TIER_RANK.member;
    return TIER_RANK[level] ?? TIER_RANK.guest;
}
