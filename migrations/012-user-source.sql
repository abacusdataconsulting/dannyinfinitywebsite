-- Track how a user account was created
ALTER TABLE users ADD COLUMN source TEXT NOT NULL DEFAULT 'self';
