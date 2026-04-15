-- Allow users to read their own credentials row.
-- Previously no SELECT policy existed (GitHub tokens were only read by Edge Functions).
-- Now that HuggingFace token is stored here and read client-side, users need SELECT on own row.

CREATE POLICY "Users can read own credentials"
  ON public.github_credentials FOR SELECT
  USING (user_id = auth.uid());
