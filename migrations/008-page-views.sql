-- Page Views table — passive tracking for all page loads across the site
-- Unlike the visits table (which tracks splash-screen auth sessions),
-- this captures every page load including direct-link and search-engine traffic.

CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,              -- Random per-tab session ID from sessionStorage
    page_url TEXT NOT NULL,       -- e.g. "/videos.html"
    referrer TEXT,
    ip_address TEXT,
    country TEXT,
    city TEXT,
    region TEXT,
    user_agent TEXT,
    device_type TEXT,             -- 'mobile', 'tablet', 'desktop'
    os TEXT,
    browser TEXT,
    language TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_page_views_visited_at ON page_views(visited_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_url ON page_views(page_url);
