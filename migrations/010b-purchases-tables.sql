-- Create purchases and purchase_items tables (if 010 partially failed)

CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_session_id TEXT UNIQUE NOT NULL,
    buyer_email TEXT,
    buyer_name TEXT,
    amount_total INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    download_token TEXT NOT NULL,
    token_expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    sheet_music_id INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (sheet_music_id) REFERENCES sheet_music(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_token ON purchases(download_token);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_id ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(buyer_email);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_sheet ON purchase_items(sheet_music_id);
