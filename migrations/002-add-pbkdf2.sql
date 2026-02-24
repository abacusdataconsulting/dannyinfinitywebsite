-- Migration: Add PBKDF2 password columns
-- Run with: npm run db:migrate

-- Add salt and version columns to users table
ALTER TABLE users ADD COLUMN password_salt TEXT;
ALTER TABLE users ADD COLUMN password_version INTEGER DEFAULT 1;
