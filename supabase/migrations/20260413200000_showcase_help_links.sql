-- GongYan Phase 4: Merge help links into showcase items
-- Each paper can have child help links (GitHub star, HuggingFace like, 小红书 etc.)

-- ===========================================
-- STEP 1: Drop standalone star_requests system
-- ===========================================

drop trigger if exists star_completions_count_delete on public.star_completions;
drop trigger if exists star_completions_count_insert on public.star_completions;
drop function if exists public.handle_star_completion_count();
drop trigger if exists star_requests_updated_at on public.star_requests;
drop table if exists public.star_completions;
drop table if exists public.star_requests;

-- ===========================================
-- STEP 2: Create showcase_help_links
-- ===========================================

create table public.showcase_help_links (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.showcase_items(id) on delete cascade,
  title text not null,
  url text not null,
  platform text not null default 'other'
    check (platform in ('github', 'huggingface', 'zhihu', 'xiaohongshu', 'wechat', 'bilibili', 'twitter', 'other')),
  action_label text not null default '点赞',
  completion_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================
-- STEP 3: Create help_completions
-- ===========================================

create table public.help_completions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.showcase_help_links(id) on delete cascade,
  helper_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (link_id, helper_id)
);

-- ===========================================
-- STEP 4: RLS
-- ===========================================

alter table public.showcase_help_links enable row level security;

create policy "Approved users can view help links"
  on public.showcase_help_links for select
  using (public.is_approved());

create policy "Users can insert help links on own items"
  on public.showcase_help_links for insert
  with check (
    public.is_approved()
    and exists (
      select 1 from public.showcase_items
      where id = item_id and user_id = auth.uid()
    )
  );

create policy "Users can update help links on own items"
  on public.showcase_help_links for update
  using (
    exists (
      select 1 from public.showcase_items
      where id = item_id and user_id = auth.uid()
    )
  );

create policy "Users can delete help links on own items"
  on public.showcase_help_links for delete
  using (
    exists (
      select 1 from public.showcase_items
      where id = item_id and user_id = auth.uid()
    )
  );

alter table public.help_completions enable row level security;

create policy "Approved users can view help completions"
  on public.help_completions for select
  using (public.is_approved());

create policy "Approved users can insert help completions"
  on public.help_completions for insert
  with check (public.is_approved() and helper_id = auth.uid());

create policy "Users can delete own help completions"
  on public.help_completions for delete
  using (helper_id = auth.uid());

-- ===========================================
-- STEP 5: Triggers
-- ===========================================

create trigger showcase_help_links_updated_at
  before update on public.showcase_help_links
  for each row execute function public.handle_updated_at();

create or replace function public.handle_help_completion_count()
returns trigger
language plpgsql
security definer
as $$
declare
  v_item_owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.showcase_help_links
    set completion_count = completion_count + 1
    where id = new.link_id;

    -- Get item owner
    select si.user_id into v_item_owner
    from public.showcase_help_links hl
    join public.showcase_items si on si.id = hl.item_id
    where hl.id = new.link_id;

    -- Update helper's help_given_count
    update public.profiles
    set help_given_count = help_given_count + 1
    where id = new.helper_id;

    -- Update owner's help_received_count
    update public.profiles
    set help_received_count = help_received_count + 1
    where id = v_item_owner;

    -- Notify the item owner
    insert into public.notifications (user_id, type, title, body, link)
    select
      v_item_owner,
      'system',
      '有人帮你完成了 ' || hl.action_label,
      p.full_name || ' 帮你完成了「' || hl.title || '」的' || hl.action_label,
      hl.url
    from public.showcase_help_links hl
    cross join public.profiles p
    where hl.id = new.link_id
      and p.id = new.helper_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.showcase_help_links
    set completion_count = completion_count - 1
    where id = old.link_id;

    select si.user_id into v_item_owner
    from public.showcase_help_links hl
    join public.showcase_items si on si.id = hl.item_id
    where hl.id = old.link_id;

    update public.profiles
    set help_given_count = help_given_count - 1
    where id = old.helper_id;

    update public.profiles
    set help_received_count = help_received_count - 1
    where id = v_item_owner;

    return old;
  end if;
  return null;
end;
$$;

create trigger help_completions_count_insert
  after insert on public.help_completions
  for each row execute function public.handle_help_completion_count();

create trigger help_completions_count_delete
  after delete on public.help_completions
  for each row execute function public.handle_help_completion_count();

-- ===========================================
-- STEP 6: Indexes
-- ===========================================

create index idx_showcase_help_links_item on public.showcase_help_links(item_id);
create index idx_showcase_help_links_active on public.showcase_help_links(is_active, created_at desc);
create index idx_help_completions_link on public.help_completions(link_id);
create index idx_help_completions_helper on public.help_completions(helper_id);
