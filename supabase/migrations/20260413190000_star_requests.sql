-- GongYan Phase 3: Star/Upvote Help Requests
-- Community mutual-help system for starring, upvoting, liking external links

-- ===========================================
-- STEP 1: Create tables
-- ===========================================

-- 1. star_requests — links a user wants help with (star/upvote/like)
create table public.star_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  url text not null,
  platform text not null default 'other'
    check (platform in ('github', 'zhihu', 'wechat', 'bilibili', 'twitter', 'other')),
  action_label text not null default '点赞',
  description text default '',
  completion_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. star_completions — records of who helped
create table public.star_completions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.star_requests(id) on delete cascade,
  helper_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (request_id, helper_id)
);

-- ===========================================
-- STEP 2: RLS
-- ===========================================

alter table public.star_requests enable row level security;

create policy "Approved users can view active star requests"
  on public.star_requests for select
  using (public.is_approved());

create policy "Users can insert own star requests"
  on public.star_requests for insert
  with check (public.is_approved() and user_id = auth.uid());

create policy "Users can update own star requests"
  on public.star_requests for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own star requests"
  on public.star_requests for delete
  using (user_id = auth.uid());

alter table public.star_completions enable row level security;

create policy "Approved users can view star completions"
  on public.star_completions for select
  using (public.is_approved());

create policy "Approved users can insert star completions"
  on public.star_completions for insert
  with check (public.is_approved() and helper_id = auth.uid());

create policy "Users can delete own star completions"
  on public.star_completions for delete
  using (helper_id = auth.uid());

-- ===========================================
-- STEP 3: Triggers
-- ===========================================

-- Reuse handle_updated_at
create trigger star_requests_updated_at
  before update on public.star_requests
  for each row execute function public.handle_updated_at();

-- Auto-maintain completion_count on star_requests
create or replace function public.handle_star_completion_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.star_requests
    set completion_count = completion_count + 1
    where id = new.request_id;

    -- Update helper's help_given_count
    update public.profiles
    set help_given_count = help_given_count + 1
    where id = new.helper_id;

    -- Update requester's help_received_count
    update public.profiles
    set help_received_count = help_received_count + 1
    where id = (select user_id from public.star_requests where id = new.request_id);

    -- Send notification to the requester
    insert into public.notifications (user_id, type, title, body, link)
    select
      sr.user_id,
      'system',
      '有人帮你完成了 ' || sr.action_label,
      p.full_name || ' 帮你完成了「' || sr.title || '」的' || sr.action_label,
      sr.url
    from public.star_requests sr
    cross join public.profiles p
    where sr.id = new.request_id
      and p.id = new.helper_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.star_requests
    set completion_count = completion_count - 1
    where id = old.request_id;

    update public.profiles
    set help_given_count = help_given_count - 1
    where id = old.helper_id;

    update public.profiles
    set help_received_count = help_received_count - 1
    where id = (select user_id from public.star_requests where id = old.request_id);

    return old;
  end if;
  return null;
end;
$$;

create trigger star_completions_count_insert
  after insert on public.star_completions
  for each row execute function public.handle_star_completion_count();

create trigger star_completions_count_delete
  after delete on public.star_completions
  for each row execute function public.handle_star_completion_count();

-- ===========================================
-- STEP 4: Indexes
-- ===========================================

create index idx_star_requests_user on public.star_requests(user_id);
create index idx_star_requests_active on public.star_requests(is_active, created_at desc);
create index idx_star_completions_request on public.star_completions(request_id);
create index idx_star_completions_helper on public.star_completions(helper_id);
