-- User-sheet access grants (from purchase linking or admin grant)
CREATE TABLE IF NOT EXISTS user_sheet_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sheet_music_id INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'purchase',
    purchase_id INTEGER,
    granted_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sheet_music_id) REFERENCES sheet_music(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, sheet_music_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sheet_access_user ON user_sheet_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sheet_access_sheet ON user_sheet_access(sheet_music_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
