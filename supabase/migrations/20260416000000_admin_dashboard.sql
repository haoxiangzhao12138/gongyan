-- Admin Dashboard: system_settings, auto-approve trigger, atomic invitation RPC

-- ===========================================
-- 1. system_settings table
-- ===========================================

create table public.system_settings (
  key text primary key,
  value jsonb not null default 'false'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

create policy "Approved users can read settings"
  on public.system_settings for select
  using (public.is_approved());

create policy "Admins can manage settings"
  on public.system_settings for all
  using (public.is_admin());

-- Seed default value
insert into public.system_settings (key, value)
values ('auto_approve', 'false'::jsonb);

-- Auto-update updated_at
create trigger system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.handle_updated_at();

-- ===========================================
-- 2. Update handle_new_user to check auto_approve
-- ===========================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto_approve boolean;
begin
  -- Check if auto-approve is enabled
  select coalesce((value)::boolean, false)
    into v_auto_approve
    from public.system_settings
    where key = 'auto_approve';

  insert into public.profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when v_auto_approve then 'approved' else 'pending' end
  );
  return new;
end;
$$;

-- ===========================================
-- 3. Atomic invitation consumption RPC
-- ===========================================

create or replace function public.consume_invitation(
  p_invitation_id uuid,
  p_used_by uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumed boolean;
begin
  update public.invitations
  set
    is_active = false,
    used_at = now(),
    used_by = p_used_by
  where id = p_invitation_id
    and is_active = true
    and used_by is null
  returning true into v_consumed;

  return coalesce(v_consumed, false);
end;
$$;

-- Grant to both authenticated and anon (registration happens pre-login)
grant execute on function public.consume_invitation(uuid, uuid) to authenticated;
grant execute on function public.consume_invitation(uuid, uuid) to anon;
