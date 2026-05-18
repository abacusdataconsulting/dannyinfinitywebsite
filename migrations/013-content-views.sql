-- Content view tracking table
CREATE TABLE IF NOT EXISTS content_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_content_views_lookup ON content_views(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_views_created ON content_views(created_at);

-- Add show_views toggle to content tables
ALTER TABLE albums ADD COLUMN show_views INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN show_views INTEGER DEFAULT 0;
ALTER TABLE sheet_music ADD COLUMN show_views INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN show_views INTEGER DEFAULT 0;
ALTER TABLE photos ADD COLUMN show_views INTEGER DEFAULT 0;
