-- GongYan Phase 2: Showcase Items (Papers, GitHub, Links)
-- Run via: supabase db query --linked < supabase/migrations/002_showcase_items.sql

-- ===========================================
-- STEP 1: Create tables
-- ===========================================

-- 1. showcase_items
create table public.showcase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null
    check (item_type in ('paper', 'github', 'link')),
  title text not null,
  url text not null,
  description text default '',
  -- paper-specific: BibTeX citation string
  citation text,
  -- github-specific: manually entered star count
  stars_count integer,
  -- link-specific: platform label (e.g. "知乎", "微信公众号")
  platform_label text,
  -- denormalized like count, maintained by trigger
  like_count integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. showcase_likes
create table public.showcase_likes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.showcase_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

-- ===========================================
-- STEP 2: RLS
-- ===========================================

alter table public.showcase_items enable row level security;

create policy "Approved users can view showcase items"
  on public.showcase_items for select
  using (public.is_approved());

create policy "Users can insert own showcase items"
  on public.showcase_items for insert
  with check (public.is_approved() and user_id = auth.uid());

create policy "Users can update own showcase items"
  on public.showcase_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own showcase items"
  on public.showcase_items for delete
  using (user_id = auth.uid());

alter table public.showcase_likes enable row level security;

create policy "Approved users can view showcase likes"
  on public.showcase_likes for select
  using (public.is_approved());

create policy "Approved users can insert showcase likes"
  on public.showcase_likes for insert
  with check (public.is_approved() and user_id = auth.uid());

create policy "Users can delete own showcase likes"
  on public.showcase_likes for delete
  using (user_id = auth.uid());

-- ===========================================
-- STEP 3: Triggers
-- ===========================================

-- Reuse handle_updated_at for showcase_items
create trigger showcase_items_updated_at
  before update on public.showcase_items
  for each row execute function public.handle_updated_at();

-- Auto-maintain like_count on showcase_items
create or replace function public.handle_showcase_like_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.showcase_items
    set like_count = like_count + 1
    where id = new.item_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.showcase_items
    set like_count = like_count - 1
    where id = old.item_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger showcase_likes_count_insert
  after insert on public.showcase_likes
  for each row execute function public.handle_showcase_like_count();

create trigger showcase_likes_count_delete
  after delete on public.showcase_likes
  for each row execute function public.handle_showcase_like_count();

-- ===========================================
-- STEP 4: Indexes
-- ===========================================

create index idx_showcase_items_user on public.showcase_items(user_id);
create index idx_showcase_items_type on public.showcase_items(user_id, item_type, sort_order);
create index idx_showcase_likes_item on public.showcase_likes(item_id);
create index idx_showcase_likes_user_item on public.showcase_likes(user_id, item_id);
