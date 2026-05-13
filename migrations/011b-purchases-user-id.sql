-- Add user_id column to purchases (run separately since ALTER TABLE can't use IF NOT EXISTS)
ALTER TABLE purchases ADD COLUMN user_id INTEGER REFERENCES users(id);
