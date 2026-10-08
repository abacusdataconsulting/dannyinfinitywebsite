-- Membership tiers + streaming page (chat, presence, moderation)
-- Run with: wrangler d1 execute abacus-db --local --file=migrations/018-tiers-streaming.sql
-- NOTE: ALTER TABLE is not idempotent — do not re-run this file.

-- Tier hierarchy: guest < member < subscriber < vip < admin < super_admin
ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'member';
UPDATE users SET tier = 'guest' WHERE name = 'guest' AND password_hash IS NULL;
UPDATE users SET tier = 'super_admin' WHERE is_admin = 1;

-- Single-row stream settings (id is always 1)
CREATE TABLE IF NOT EXISTS stream_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'offline',            -- 'video' | 'channel_live' | 'offline'
    video_id TEXT,                                   -- YouTube video ID (mode='video')
    channel_id TEXT,                                 -- YouTube channel ID (mode='channel_live')
    title TEXT NOT NULL DEFAULT 'Live Stream',
    is_live INTEGER NOT NULL DEFAULT 0,              -- shows LIVE badge
    offline_message TEXT NOT NULL DEFAULT 'Stream is offline. Check back soon!',
    chat_enabled INTEGER NOT NULL DEFAULT 1,
    mute_notice_enabled INTEGER NOT NULL DEFAULT 0,  -- 0 = silent drop, 1 = "you are muted" error
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO stream_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,                       -- denormalized at post time
    tier TEXT NOT NULL DEFAULT 'member',             -- denormalized for display
    body TEXT NOT NULL,
    ip TEXT,                                         -- moderation only, never public
    country TEXT,                                    -- moderation only
    status TEXT NOT NULL DEFAULT 'visible',          -- 'visible' | 'hidden'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Cheap "new since id" polling
CREATE INDEX IF NOT EXISTS idx_chat_messages_poll ON chat_messages(status, id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

CREATE TABLE IF NOT EXISTS chat_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,          -- 'user' | 'ip'
    value TEXT NOT NULL,                -- username (case-insensitive) or IP string
    type TEXT NOT NULL,                 -- 'mute' | 'ban'
    reason TEXT,
    expires_at DATETIME,                -- NULL = permanent
    created_by INTEGER,                 -- admin user id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_bans_lookup ON chat_bans(target_type, value);

CREATE TABLE IF NOT EXISTS stream_viewers (
    viewer_key TEXT PRIMARY KEY,        -- 'u:<user_id>' or 'g:<client uuid>'
    user_id INTEGER,                    -- NULL for guests
    name TEXT,                          -- NULL for guests (rendered as 'Guest')
    tier TEXT,
    country TEXT,
    city TEXT,                          -- admin-only detail
    ip TEXT,                            -- admin-only detail
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_seen ON stream_viewers(last_seen);

-- Streaming page entry for the page-access controls (no preview gate — it's not a list page)
INSERT OR IGNORE INTO page_access (page, required_level, gate_enabled, anon_preview_count) VALUES
    ('streaming', 'public', 0, 0);
