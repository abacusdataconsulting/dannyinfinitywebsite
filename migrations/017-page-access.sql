-- Per-page access control + anonymous preview gating for media pages
-- Run with: wrangler d1 execute abacus-db --local --file=migrations/017-page-access.sql

CREATE TABLE IF NOT EXISTS page_access (
    page TEXT PRIMARY KEY,                           -- 'photos'|'videos'|'music'|'blog'|'sheet-music'
    required_level TEXT NOT NULL DEFAULT 'public',   -- 'public' | 'logged_in'
    gate_enabled INTEGER NOT NULL DEFAULT 0,         -- anonymous preview gate on/off
    anon_preview_count INTEGER NOT NULL DEFAULT 8    -- items anonymous users see before the sign-in prompt
);

INSERT OR IGNORE INTO page_access (page, required_level, gate_enabled, anon_preview_count) VALUES
    ('photos',      'public', 1, 8),
    ('videos',      'public', 1, 6),
    ('music',       'public', 1, 3),
    ('blog',        'public', 0, 3),
    ('sheet-music', 'public', 0, 6);
