/**
 * Public sheet music API
 * Respects visibility settings and optional user authentication
 */
import { Hono } from 'hono';
import { fileUrl } from '../../utils/fileUrl.js';
import { optionalUserAuth } from '../../middleware/userAuth.js';

const publicSheetMusic = new Hono();

publicSheetMusic.get('/', optionalUserAuth, async (c) => {
    const user = c.get('user');
    const isAdmin = user && user.isAdmin;

    // Base query: always get public sheets
    let sheets;

    if (isAdmin) {
        // Admin sees everything (published)
        const result = await c.env.DB.prepare(
            `SELECT id, slug, title, composer, arrangement, year, pages, description, pdf_r2_key, tip_link, price_cents, visibility, show_views,
                (SELECT COUNT(*) FROM content_views WHERE content_type = 'sheet' AND content_id = sheet_music.id) as view_count
            FROM sheet_music WHERE is_published = 1 ORDER BY sort_order ASC, created_at ASC`
        ).all();
        sheets = result.results;
    } else if (user) {
        // Logged-in user sees: public + purchasers sheets they have access to
        const result = await c.env.DB.prepare(`
            SELECT DISTINCT sm.id, sm.slug, sm.title, sm.composer, sm.arrangement, sm.year,
                   sm.pages, sm.description, sm.pdf_r2_key, sm.tip_link, sm.price_cents, sm.visibility, sm.show_views,
                   CASE WHEN usa.id IS NOT NULL THEN 1 ELSE 0 END as has_access,
                   (SELECT COUNT(*) FROM content_views WHERE content_type = 'sheet' AND content_id = sm.id) as view_count
            FROM sheet_music sm
            LEFT JOIN user_sheet_access usa ON usa.sheet_music_id = sm.id AND usa.user_id = ?
            WHERE sm.is_published = 1
              AND (sm.visibility = 'public' OR (sm.visibility = 'purchasers' AND usa.id IS NOT NULL))
            ORDER BY sm.sort_order ASC, sm.created_at ASC
        `).bind(user.id).all();
        sheets = result.results;
    } else {
        // Anonymous: only public sheets
        const result = await c.env.DB.prepare(
            `SELECT id, slug, title, composer, arrangement, year, pages, description, pdf_r2_key, tip_link, price_cents, visibility, show_views,
                (SELECT COUNT(*) FROM content_views WHERE content_type = 'sheet' AND content_id = sheet_music.id) as view_count
            FROM sheet_music WHERE is_published = 1 AND visibility = 'public' ORDER BY sort_order ASC, created_at ASC`
        ).all();
        sheets = result.results;
    }

    const mapped = sheets.map(s => {
        const isPaid = s.price_cents > 0;
        const hasAccess = Boolean(s.has_access) || isAdmin;
        const url = fileUrl(c.env, s.pdf_r2_key);

        return {
            id: s.id,
            slug: s.slug,
            title: s.title,
            composer: s.composer,
            arrangement: s.arrangement,
            year: s.year,
            pages: s.pages,
            description: s.description || '',
            price: s.price_cents || 0,
            visibility: s.visibility || 'public',
            pdfUrl: (!isPaid || hasAccess) ? url : null,
            previewUrl: null,
            owned: hasAccess && isPaid,
            tipLink: s.tip_link || '#',
            viewCount: s.view_count || 0,
            showViews: !!s.show_views,
        };
    });

    return c.json({ sheets: mapped });
});

export default publicSheetMusic;
