-- GongYan Admin Bootstrap
-- Run this AFTER deploying 001_initial_schema.sql
--
-- Step 1: Insert seed invitation (run BEFORE anyone registers)
-- Step 2: Register via the app with code GONGYAN-SEED-2024
-- Step 3: Promote yourself to admin (replace YOUR_EMAIL)

-- ============================================
-- STEP 1: Seed invitation code
-- (temporarily drops FK + NOT NULL because no profiles exist yet)
-- ============================================

ALTER TABLE public.invitations DROP CONSTRAINT invitations_created_by_fkey;
ALTER TABLE public.invitations ALTER COLUMN created_by DROP NOT NULL;

INSERT INTO public.invitations (code, created_by, expires_at)
VALUES (
  'GONGYAN-SEED-2024',
  NULL,
  now() + interval '30 days'
);

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- ============================================
-- STEP 2: After registering, promote to admin
-- Replace YOUR_EMAIL with your actual email
-- ============================================

-- UPDATE public.profiles
-- SET status = 'approved', is_admin = true
-- WHERE email = 'YOUR_EMAIL';

-- ============================================
-- STEP 3: (Optional) Fix seed invitation owner
-- ============================================

-- UPDATE public.invitations
-- SET created_by = (SELECT id FROM public.profiles WHERE email = 'YOUR_EMAIL')
-- WHERE code = 'GONGYAN-SEED-2024';
