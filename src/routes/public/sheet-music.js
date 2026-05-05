/**
 * Public sheet music API
 */
import { Hono } from 'hono';
import { fileUrl } from '../../utils/fileUrl.js';

const publicSheetMusic = new Hono();

publicSheetMusic.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, slug, title, composer, arrangement, year, pages, description, pdf_r2_key, tip_link, price_cents FROM sheet_music WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC'
    ).all();

    const sheets = result.results.map(s => {
        const isPaid = s.price_cents > 0;
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
            pdfUrl: isPaid ? null : url,
            previewUrl: isPaid ? url : null,
            tipLink: s.tip_link || '#',
        };
    });

    return c.json({ sheets });
});

export default publicSheetMusic;
