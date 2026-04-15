-- Phase 3: Enhanced Paper Import (DBLP + HuggingFace enrichment)

-- Add arxiv_id for paper→HuggingFace/AlphaXiv bridging
ALTER TABLE public.showcase_items
  ADD COLUMN IF NOT EXISTS arxiv_id text;

-- Make github_token nullable so HF-only users can have a row
ALTER TABLE public.github_credentials
  ALTER COLUMN github_token DROP NOT NULL;

-- Add HuggingFace token to github_credentials table (reusing the secure table)
ALTER TABLE public.github_credentials
  ADD COLUMN IF NOT EXISTS huggingface_token text;

-- Link table: paper showcase item → discovered GitHub repos
CREATE TABLE IF NOT EXISTS public.paper_repo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_item_id uuid NOT NULL REFERENCES public.showcase_items(id) ON DELETE CASCADE,
  github_url text NOT NULL,
  repo_name text,
  stars_count integer DEFAULT 0,
  source text NOT NULL DEFAULT 'huggingface',
  created_at timestamptz DEFAULT now(),
  UNIQUE(paper_item_id, github_url)
);

CREATE INDEX IF NOT EXISTS idx_paper_repo_links_paper
  ON public.paper_repo_links(paper_item_id);

ALTER TABLE public.paper_repo_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paper repo links visible to all"
  ON public.paper_repo_links FOR SELECT USING (true);

CREATE POLICY "Users can manage own paper repo links"
  ON public.paper_repo_links FOR ALL USING (
    EXISTS (SELECT 1 FROM public.showcase_items si
            WHERE si.id = paper_item_id AND si.user_id = auth.uid())
  );
