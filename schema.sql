-- Abacus Database Schema
-- Run with: npm run db:init (local) or npm run db:init:remote (production)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    password_salt TEXT,
    password_version INTEGER DEFAULT 1,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Visits table - tracks all visits to the site
CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    login_type TEXT,              -- 'guest', 'member', 'admin'
    ip_address TEXT,
    country TEXT,
    city TEXT,
    region TEXT,
    user_agent TEXT,
    device_type TEXT,             -- 'mobile', 'tablet', 'desktop'
    os TEXT,                      -- 'iOS', 'Android', 'Windows', 'macOS', 'Linux', etc.
    os_version TEXT,              -- OS version number
    browser TEXT,                 -- 'Chrome', 'Safari', 'Firefox', etc.
    browser_version TEXT,         -- Browser version number
    browser_engine TEXT,          -- 'WebKit', 'Gecko', 'Blink', etc.
    language TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    window_width INTEGER,
    window_height INTEGER,
    timezone TEXT,
    referrer TEXT,
    client_timestamp TEXT,        -- User's local datetime
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions table - for authenticated sessions
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Insert a guest user (no password)
INSERT OR IGNORE INTO users (name, is_admin)
VALUES ('guest', 0);
