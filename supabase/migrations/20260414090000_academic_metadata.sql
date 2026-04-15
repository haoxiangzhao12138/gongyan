-- Add academic metadata columns to showcase_items
ALTER TABLE public.showcase_items
  ADD COLUMN doi text,
  ADD COLUMN year integer,
  ADD COLUMN venue text,
  ADD COLUMN citation_count integer,
  ADD COLUMN openalex_id text;

-- Prevent duplicate DOI per user
CREATE UNIQUE INDEX idx_showcase_items_user_doi
  ON public.showcase_items (user_id, doi) WHERE doi IS NOT NULL;

-- Add Google Scholar URL to profiles
ALTER TABLE public.profiles
  ADD COLUMN google_scholar_url text;
