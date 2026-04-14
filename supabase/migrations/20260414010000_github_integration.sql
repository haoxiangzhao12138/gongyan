-- Add GitHub OAuth integration fields to profiles
alter table public.profiles
  add column github_token text,
  add column github_username text;
