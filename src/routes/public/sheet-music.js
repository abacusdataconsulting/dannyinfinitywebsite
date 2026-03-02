/**
 * Public sheet music API
 */
import { Hono } from 'hono';

const publicSheetMusic = new Hono();

publicSheetMusic.get('/', async (c) => {
    const result = await c.env.DB.prepare(
        'SELECT id, slug, title, composer, arrangement, year, pages, description, pdf_r2_key, tip_link FROM sheet_music WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC'
    ).all();

    const sheets = result.results.map(s => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        composer: s.composer,
        arrangement: s.arrangement,
        year: s.year,
        pages: s.pages,
        description: s.description || '',
        pdfUrl: s.pdf_r2_key ? `/api/files/${s.pdf_r2_key}` : null,
        tipLink: s.tip_link || '#',
    }));

    return c.json({ sheets });
});

export default publicSheetMusic;
