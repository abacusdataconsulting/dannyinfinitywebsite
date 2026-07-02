-- Comments system
-- Run with: npm run db:migrate:comments  (local) / :remote (production)

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,          -- 'album' | 'video' | 'photo' | 'blog' (mirrors content_views)
    content_id   INTEGER NOT NULL,       -- albums.id / videos.id / photos.id / blog_posts.id
    author_name  TEXT NOT NULL,
    body         TEXT NOT NULL,
    user_id      INTEGER,                -- set if a logged-in user posted
    status       TEXT NOT NULL DEFAULT 'visible',  -- 'visible' | 'hidden'
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments(content_type, content_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_status  ON comments(status, created_at);

CREATE TABLE IF NOT EXISTS banned_phrases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phrase     TEXT NOT NULL UNIQUE,     -- stored lowercased; matched as case-insensitive substring
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One row per content section; seeded with defaults (anyone can comment, visible)
CREATE TABLE IF NOT EXISTS comment_settings (
    section    TEXT PRIMARY KEY,         -- 'album' | 'video' | 'photo' | 'blog'
    post_mode  TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'logged_in' | 'closed'
    is_visible INTEGER NOT NULL DEFAULT 1      -- 0 hides the whole comments UI for the section
);
INSERT OR IGNORE INTO comment_settings (section) VALUES ('album'), ('video'), ('photo'), ('blog');
