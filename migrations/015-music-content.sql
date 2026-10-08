-- Music content: album descriptions, track descriptions + lyrics
-- Run with: wrangler d1 execute abacus-db --local --file=migrations/015-music-content.sql

ALTER TABLE albums ADD COLUMN description TEXT;
ALTER TABLE tracks ADD COLUMN description TEXT;
ALTER TABLE tracks ADD COLUMN lyrics TEXT;
