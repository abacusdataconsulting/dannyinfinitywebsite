-- Seed existing sheet music data
INSERT OR IGNORE INTO sheet_music (slug, title, composer, arrangement, year, pages, pdf_r2_key, tip_link, sort_order, is_published)
VALUES
    ('midnight-protocol', 'Midnight Protocol', 'Danny Infinity', 'Piano Solo', 2026, 4, NULL, NULL, 1, 1),
    ('digital-rain', 'Digital Rain', 'Danny Infinity', 'Piano + Strings', 2025, 6, NULL, NULL, 2, 1),
    ('cipher', 'Cipher', 'Danny Infinity', 'Full Score', 2025, 8, NULL, NULL, 3, 1),
    ('ghost-signal', 'Ghost Signal', 'Danny Infinity', 'Lead Sheet', 2024, 2, NULL, NULL, 4, 1),
    ('neon-pulse', 'Neon Pulse', 'Danny Infinity', 'Piano Solo', 2024, 3, NULL, NULL, 5, 1),
    ('ice-minneapolis', 'ice on the ground in minneapolis (Renee)', 'Danny Infinity', 'Piano Arrangement', 2026, 5, NULL, NULL, 6, 1);
