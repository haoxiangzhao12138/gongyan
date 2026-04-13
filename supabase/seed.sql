-- GongYan Admin Bootstrap
-- Run this AFTER deploying 001_initial_schema.sql and creating your first admin user
--
-- Step 1: Register as a normal user via the app (with a seed invite code)
-- Step 2: Run this SQL to promote your account and create the seed invitation
--
-- Replace YOUR_EMAIL with the email you registered with

-- 1. Insert a seed invitation code (allows first user to register)
-- Run this BEFORE anyone registers:
INSERT INTO public.invitations (code, created_by, expires_at)
VALUES (
  'GONGYAN-SEED-2024',
  '00000000-0000-0000-0000-000000000000', -- placeholder, update after first user
  now() + interval '30 days'
);

-- 2. After registering with the seed code, promote yourself to admin:
-- UPDATE public.profiles
-- SET status = 'approved', is_admin = true
-- WHERE email = 'YOUR_EMAIL';

-- 3. (Optional) Update the seed invitation to point to the real creator:
-- UPDATE public.invitations
-- SET created_by = (SELECT id FROM public.profiles WHERE email = 'YOUR_EMAIL')
-- WHERE code = 'GONGYAN-SEED-2024';
