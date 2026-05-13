-- Add visibility column to sheet_music (run separately since ALTER TABLE can't use IF NOT EXISTS)
ALTER TABLE sheet_music ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
