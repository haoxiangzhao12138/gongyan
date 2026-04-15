-- Fix: GitHub re-link fails because upsert requires SELECT policy.
-- Solution: SECURITY DEFINER RPC that does INSERT ... ON CONFLICT UPDATE.
-- Also removes HuggingFace binding artifacts (column + RPC).

-- ===========================================
-- STEP 1: Drop HuggingFace RPC
-- ===========================================

DROP FUNCTION IF EXISTS public.get_hf_token();

-- ===========================================
-- STEP 2: Drop huggingface_token column
-- ===========================================

ALTER TABLE public.github_credentials
  DROP COLUMN IF EXISTS huggingface_token;

-- ===========================================
-- STEP 3: Create save_github_credentials RPC
-- ===========================================

CREATE OR REPLACE FUNCTION public.save_github_credentials(
  p_github_token text,
  p_github_refresh_token text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.github_credentials (user_id, github_token, github_refresh_token, updated_at)
  VALUES (auth.uid(), p_github_token, p_github_refresh_token, now())
  ON CONFLICT (user_id) DO UPDATE SET
    github_token = p_github_token,
    github_refresh_token = COALESCE(p_github_refresh_token, public.github_credentials.github_refresh_token),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_github_credentials(text, text) TO authenticated;
