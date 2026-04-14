-- Phase 0: Move GitHub tokens from profiles to a dedicated table.
-- Tokens were previously readable by any approved user via profiles RLS.
-- The new table has NO select policy so only service_role (Edge Functions) can read.

-- ===========================================
-- STEP 1: Create github_credentials table
-- ===========================================

CREATE TABLE public.github_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  github_token text NOT NULL,
  github_refresh_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.github_credentials ENABLE ROW LEVEL SECURITY;

-- NO select policy → regular users cannot read any row.
-- Edge Functions use service_role which bypasses RLS.

-- Users can insert their own credentials (after OAuth callback)
CREATE POLICY "Users can insert own credentials"
  ON public.github_credentials FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own credentials (re-linking GitHub)
CREATE POLICY "Users can update own credentials"
  ON public.github_credentials FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own credentials (unlinking GitHub)
CREATE POLICY "Users can delete own credentials"
  ON public.github_credentials FOR DELETE
  USING (user_id = auth.uid());

-- ===========================================
-- STEP 2: Migrate existing data
-- ===========================================

INSERT INTO public.github_credentials (user_id, github_token, github_refresh_token)
SELECT id, github_token, github_refresh_token
FROM public.profiles
WHERE github_token IS NOT NULL;

-- ===========================================
-- STEP 3: Drop token columns from profiles
-- ===========================================

ALTER TABLE public.profiles DROP COLUMN IF EXISTS github_token;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS github_refresh_token;
