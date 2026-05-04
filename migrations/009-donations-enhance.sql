-- Enhance donations table with tip tracking fields
-- Adds: tip_type (preset_5, preset_10, preset_25, custom), source (general, sheet), sheet_title

ALTER TABLE donations ADD COLUMN tip_type TEXT DEFAULT 'unknown';
ALTER TABLE donations ADD COLUMN source TEXT DEFAULT 'unknown';
ALTER TABLE donations ADD COLUMN sheet_title TEXT;

CREATE INDEX IF NOT EXISTS idx_donations_source ON donations(source);
CREATE INDEX IF NOT EXISTS idx_donations_tip_type ON donations(tip_type);
