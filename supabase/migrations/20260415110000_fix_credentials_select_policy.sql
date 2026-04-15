-- Fix: Remove permissive SELECT policy that exposes GitHub tokens to browser.
-- Replace with a SECURITY DEFINER function that only returns huggingface_token.

-- Drop the permissive SELECT policy
DROP POLICY IF EXISTS "Users can read own credentials" ON public.github_credentials;

-- Create RPC function to safely read only the HuggingFace token
CREATE OR REPLACE FUNCTION public.get_hf_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT huggingface_token
  FROM public.github_credentials
  WHERE user_id = auth.uid()
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_hf_token() TO authenticated;
