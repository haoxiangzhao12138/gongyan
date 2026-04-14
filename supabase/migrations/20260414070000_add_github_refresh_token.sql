-- Add github_refresh_token column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_refresh_token text;
