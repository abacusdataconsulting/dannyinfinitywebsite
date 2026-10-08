-- Option to hide the stream chat entirely while the stream is offline
-- Run with: wrangler d1 execute abacus-db --local --file=migrations/019-chat-offline-toggle.sql
-- NOTE: ALTER TABLE is not idempotent — do not re-run this file.

ALTER TABLE stream_settings ADD COLUMN hide_chat_when_offline INTEGER NOT NULL DEFAULT 0;
