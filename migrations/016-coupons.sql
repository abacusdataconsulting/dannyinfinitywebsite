-- Coupon codes for paid sheet music
-- Run with: wrangler d1 execute abacus-db --local --file=migrations/016-coupons.sql

CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    percent_off INTEGER CHECK (percent_off BETWEEN 1 AND 100),  -- either percent_off...
    amount_off_cents INTEGER CHECK (amount_off_cents > 0),      -- ...or fixed amount (exactly one set)
    sheet_id INTEGER,              -- NULL = applies to all paid sheets
    max_uses INTEGER,              -- NULL = unlimited
    times_used INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME,           -- NULL = never
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK ((percent_off IS NULL) != (amount_off_cents IS NULL))
);
