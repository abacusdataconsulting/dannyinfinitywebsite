-- CMS Content Tables
-- Run with: npm run db:migrate:cms

CREATE TABLE IF NOT EXISTS sheet_music (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    composer TEXT NOT NULL DEFAULT 'Danny Infinity',
    arrangement TEXT NOT NULL,
    year TEXT NOT NULL,
    pages INTEGER NOT NULL DEFAULT 1,
    pdf_r2_key TEXT,
    tip_link TEXT,
    sort_order INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT 'Danny Infinity',
    type TEXT NOT NULL DEFAULT 'Album',
    year TEXT NOT NULL,
    gradient TEXT DEFAULT 'gradient-1',
    cover_r2_key TEXT,
    sort_order INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    duration TEXT NOT NULL,
    audio_r2_key TEXT,
    track_number INTEGER NOT NULL,
    is_published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'music-video',
    orientation TEXT DEFAULT 'landscape',
    duration TEXT,
    video_type TEXT DEFAULT 'youtube',
    video_src TEXT,
    thumbnail_r2_key TEXT,
    year TEXT,
    sort_order INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tag TEXT DEFAULT 'UPDATE',
    published_at DATETIME,
    is_published INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'live',
    orientation TEXT DEFAULT 'landscape',
    image_r2_key TEXT,
    thumb_r2_key TEXT,
    date TEXT,
    sort_order INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_payment_id TEXT UNIQUE,
    sheet_music_id INTEGER,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    donor_email TEXT,
    donor_name TEXT,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sheet_music_id) REFERENCES sheet_music(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sheet_music_slug ON sheet_music(slug);
CREATE INDEX IF NOT EXISTS idx_sheet_music_published ON sheet_music(is_published);
CREATE INDEX IF NOT EXISTS idx_albums_slug ON albums(slug);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_videos_slug ON videos(slug);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_photos_category ON photos(category);
CREATE INDEX IF NOT EXISTS idx_donations_stripe_id ON donations(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_donations_sheet_id ON donations(sheet_music_id);
