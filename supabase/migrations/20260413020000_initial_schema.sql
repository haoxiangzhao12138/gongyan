-- GongYan Phase 1: Initial Schema
-- Run this in Supabase SQL Editor

-- ===========================================
-- STEP 1: Create all tables (no RLS yet)
-- ===========================================

-- 1. profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  bio text default '',
  research_field text default '',
  institution text default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  is_admin boolean not null default false,
  badge_level text not null default 'newcomer'
    check (badge_level in ('newcomer', 'helper', 'expert', 'mentor')),
  help_given_count integer not null default 0,
  help_received_count integer not null default 0,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. invitations
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references public.profiles(id),
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. help_posts
create table public.help_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  title text not null,
  description text not null,
  category text not null default 'other'
    check (category in (
      'paper_review', 'data_analysis', 'methodology',
      'writing', 'resources', 'career', 'other'
    )),
  urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  response_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. help_responses
create table public.help_responses (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.help_posts(id) on delete cascade,
  responder_id uuid not null references public.profiles(id),
  content text not null,
  is_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null
    check (type in (
      'approval_approved', 'approval_rejected',
      'new_response', 'response_accepted',
      'new_post', 'system'
    )),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 6. activity_log
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ===========================================
-- STEP 2: Helper functions (tables exist now)
-- ===========================================

create or replace function public.is_approved()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_admin = true
      and status = 'approved'
  );
$$;

-- ===========================================
-- STEP 3: Enable RLS + Policies
-- ===========================================

-- profiles
alter table public.profiles enable row level security;

create policy "Approved users can view approved profiles"
  on public.profiles for select
  using (
    auth.uid() is not null
    and (
      id = auth.uid()
      or (public.is_approved() and status = 'approved')
      or public.is_admin()
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

create policy "Service role can insert profiles"
  on public.profiles for insert
  with check (true);

-- invitations
alter table public.invitations enable row level security;

create policy "Anyone can validate invitation codes"
  on public.invitations for select
  using (true);

create policy "Approved users can create invitations"
  on public.invitations for insert
  with check (public.is_approved() and created_by = auth.uid());

create policy "Users can mark invitation as used"
  on public.invitations for update
  using (
    is_active = true
    and used_by is null
  );

-- help_posts
alter table public.help_posts enable row level security;

create policy "Approved users can view posts"
  on public.help_posts for select
  using (public.is_approved());

create policy "Approved users can create posts"
  on public.help_posts for insert
  with check (public.is_approved() and author_id = auth.uid());

create policy "Authors can update own posts"
  on public.help_posts for update
  using (author_id = auth.uid());

create policy "Authors can delete own posts"
  on public.help_posts for delete
  using (author_id = auth.uid());

-- help_responses
alter table public.help_responses enable row level security;

create policy "Approved users can view responses"
  on public.help_responses for select
  using (public.is_approved());

create policy "Approved users can create responses"
  on public.help_responses for insert
  with check (public.is_approved() and responder_id = auth.uid());

create policy "Responders can update own responses"
  on public.help_responses for update
  using (responder_id = auth.uid());

create policy "Responders can delete own responses"
  on public.help_responses for delete
  using (responder_id = auth.uid());

-- notifications
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "Authenticated users can receive notifications"
  on public.notifications for insert
  with check (true);

create policy "Users can update own notifications"
  on public.notifications for update
  using (user_id = auth.uid());

-- activity_log
alter table public.activity_log enable row level security;

create policy "Admins can view activity log"
  on public.activity_log for select
  using (public.is_admin());

create policy "Users can view own activity"
  on public.activity_log for select
  using (actor_id = auth.uid() and public.is_approved());

create policy "Authenticated users can log activity"
  on public.activity_log for insert
  with check (actor_id = auth.uid());

-- ===========================================
-- STEP 4: Triggers
-- ===========================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger help_posts_updated_at
  before update on public.help_posts
  for each row execute function public.handle_updated_at();

create trigger help_responses_updated_at
  before update on public.help_responses
  for each row execute function public.handle_updated_at();

-- Auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update badge_level based on help_given_count
create or replace function public.handle_badge_update()
returns trigger
language plpgsql
as $$
begin
  new.badge_level = case
    when new.help_given_count >= 50 then 'mentor'
    when new.help_given_count >= 20 then 'expert'
    when new.help_given_count >= 5 then 'helper'
    else 'newcomer'
  end;
  return new;
end;
$$;

create trigger profiles_badge_update
  before update of help_given_count on public.profiles
  for each row execute function public.handle_badge_update();

-- Auto-update response_count on help_posts
create or replace function public.handle_response_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.help_posts
    set response_count = response_count + 1
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.help_posts
    set response_count = response_count - 1
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger help_responses_count_insert
  after insert on public.help_responses
  for each row execute function public.handle_response_count();

create trigger help_responses_count_delete
  after delete on public.help_responses
  for each row execute function public.handle_response_count();

-- ===========================================
-- STEP 5: Indexes
-- ===========================================

create index idx_profiles_status on public.profiles(status);
create index idx_invitations_code on public.invitations(code);
create index idx_help_posts_category on public.help_posts(category);
create index idx_help_posts_status on public.help_posts(status);
create index idx_help_posts_author on public.help_posts(author_id);
create index idx_help_posts_created on public.help_posts(created_at desc);
create index idx_help_responses_post on public.help_responses(post_id);
create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_unread on public.notifications(user_id, is_read) where is_read = false;
create index idx_activity_log_actor on public.activity_log(actor_id);
create index idx_activity_log_created on public.activity_log(created_at desc);
