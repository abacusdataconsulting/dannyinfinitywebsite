-- Seed blog post
INSERT OR IGNORE INTO blog_posts (slug, title, body, tag, published_at, is_published)
VALUES
    ('coming-soon', 'Coming Soon...', '<p>The blog is under construction. Stay tuned for updates on new music, behind-the-scenes content, production breakdowns, and more.</p><p class="post-signature">&mdash; Danny Infinity</p>', 'UPDATE', '2026-02-24', 1);

-- Seed videos
INSERT OR IGNORE INTO videos (slug, title, category, orientation, duration, video_type, video_src, thumbnail_r2_key, year, sort_order, is_published)
VALUES
    ('neon-dreams-mv', 'Neon Dreams (Official Video)', 'music-video', 'landscape', '3:42', NULL, NULL, NULL, 2024, 1, 1),
    ('warehouse-festival', 'Live at Warehouse Festival', 'live', 'landscape', '45:21', NULL, NULL, NULL, 2024, 2, 1),
    ('making-neon-dreams', 'Making of "Neon Dreams"', 'bts', 'portrait', '8:15', NULL, NULL, NULL, 2024, 3, 1),
    ('digital-rain-mv', 'Digital Rain (Official Video)', 'music-video', 'portrait', '4:08', NULL, NULL, NULL, 2024, 4, 1),
    ('midnight-protocol-live', 'Midnight Protocol - Live Session', 'live', 'landscape', '12:33', NULL, NULL, NULL, 2024, 5, 1),
    ('studio-tour-2024', 'Studio Tour 2024', 'bts', 'landscape', '15:42', NULL, NULL, NULL, 2024, 6, 1);

-- Seed photos
INSERT OR IGNORE INTO photos (title, category, orientation, image_r2_key, date, sort_order, is_published)
VALUES
    ('Live Performance', 'live', 'landscape', NULL, '2024-01-01', 1, 1),
    ('Studio Session', 'studio', 'portrait', NULL, '2024-01-01', 2, 1),
    ('Behind The Scenes', 'bts', 'landscape', NULL, '2024-01-01', 3, 1),
    ('Concert Night', 'live', 'square', NULL, '2024-01-01', 4, 1),
    ('Recording Session', 'studio', 'landscape', NULL, '2024-01-01', 5, 1),
    ('Backstage', 'bts', 'portrait', NULL, '2024-01-01', 6, 1),
    ('Festival Set', 'live', 'landscape', NULL, '2024-01-01', 7, 1),
    ('Mixing Board', 'studio', 'square', NULL, '2024-01-01', 8, 1);
