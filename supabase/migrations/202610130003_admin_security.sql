-- ============================================================
-- Admin security: 2FA, session timeout, access log, config audit, user badges
-- ============================================================

-- ============================================================
-- 1) Profiles: 2FA + admin session expiry
-- ============================================================
alter table public.profiles
  add column if not exists totp_secret text,
  add column if not exists totp_enabled boolean not null default false,
  add column if not exists admin_session_expires_at timestamptz,
  add column if not exists failed_login_attempts int not null default 0,
  add column if not exists last_failed_login_at timestamptz,
  add column if not exists password_changed_at timestamptz not null default now();

-- Index for cleanup of expired sessions
create index if not exists profiles_admin_session_exp_idx
  on public.profiles (admin_session_expires_at)
  where admin_session_expires_at is not null;

-- ============================================================
-- 2) Admin access logs
-- ============================================================
create table if not exists public.admin_access_logs (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  ip inet,
  user_agent text,
  path text not null,
  success boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists admin_access_logs_user_created_idx
  on public.admin_access_logs (user_id, created_at desc);
create index if not exists admin_access_logs_created_idx
  on public.admin_access_logs (created_at desc);

alter table public.admin_access_logs enable row level security;

drop policy if exists admin_access_logs_admin_read on public.admin_access_logs;
create policy admin_access_logs_admin_read on public.admin_access_logs
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists admin_access_logs_insert on public.admin_access_logs;
create policy admin_access_logs_insert on public.admin_access_logs
  for insert with check (true); -- Edge functions / middleware insert

-- ============================================================
-- 3) Config audit log (for feature flags, maintenance, etc.)
-- ============================================================
create table if not exists public.admin_config_changes (
  id bigserial primary key,
  config_key text not null,
  old_value jsonb,
  new_value jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  description text
);

create index if not exists admin_config_changes_key_changed_idx
  on public.admin_config_changes (config_key, changed_at desc);

alter table public.admin_config_changes enable row level security;

drop policy if exists admin_config_changes_admin_read on public.admin_config_changes;
create policy admin_config_changes_admin_read on public.admin_config_changes
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists admin_config_changes_admin_write on public.admin_config_changes;
create policy admin_config_changes_admin_write on public.admin_config_changes
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Auto-insert on app_config changes
create or replace function public.tg_app_config_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.admin_config_changes (config_key, new_value, changed_by, description)
    values (NEW.key, NEW.value, NEW.updated_by, 'إضافة إعداد جديد');
  elsif (TG_OP = 'UPDATE') then
    insert into public.admin_config_changes (config_key, old_value, new_value, changed_by, description)
    values (NEW.key, OLD.value, NEW.value, NEW.updated_by, 'تعديل إعداد');
  elsif (TG_OP = 'DELETE') then
    insert into public.admin_config_changes (config_key, old_value, changed_by, description)
    values (OLD.key, OLD.value, OLD.updated_by, 'حذف إعداد');
  end if;
  return null;
end;
$$;

drop trigger if exists tg_app_config_audit on public.app_config;
create trigger tg_app_config_audit
after insert or update or delete on public.app_config
for each row execute function public.tg_app_config_audit();

-- ============================================================
-- 4) User badges (auto-awarded)
-- ============================================================
create table if not exists public.user_badges (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null,
  badge_label text not null,
  badge_description text,
  badge_icon text, -- emoji or icon name
  tier int not null default 1, -- 1=برونزي، 2=فضي، 3=ذهبي
  earned_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  unique (user_id, badge_key, tier)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id, earned_at desc);

alter table public.user_badges enable row level security;

drop policy if exists user_badges_read on public.user_badges;
create policy user_badges_read on public.user_badges
  for select using (true); -- public profiles can show badges

drop policy if exists user_badges_admin_write on public.user_badges;
create policy user_badges_admin_write on public.user_badges
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Seed badge definitions (reference only; actual awards via triggers/functions)
-- Badge keys: service_provider_5, service_provider_10, service_provider_25
--             request_completer_5, request_completer_10
--             helpful_neighbor_10, helpful_neighbor_50
--             ambassador, verified_contributor

-- ============================================================
-- 5) Function to check/administer 2FA
-- ============================================================
create or replace function public.admin_enable_2fa(p_user_id uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set totp_secret = p_secret, totp_enabled = true
  where id = p_user_id;
end;
$$;

create or replace function public.admin_disable_2fa(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set totp_secret = null, totp_enabled = false
  where id = p_user_id;
end;
$$;

create or replace function public.admin_reset_failed_logins(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set failed_login_attempts = 0, last_failed_login_at = null
  where id = p_user_id;
end;
$$;

create or replace function public.admin_record_failed_login(p_user_id uuid, p_ip inet)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set failed_login_attempts = failed_login_attempts + 1,
      last_failed_login_at = now()
  where id = p_user_id;

  insert into public.admin_access_logs (user_id, ip, path, success, error_message)
  values (p_user_id, p_ip, '/admin/login', false, 'محاولة دخول فاشلة');
end;
$$;

grant execute on function public.admin_enable_2fa(uuid, text) to service_role;
grant execute on function public.admin_disable_2fa(uuid) to service_role;
grant execute on function public.admin_reset_failed_logins(uuid) to service_role;
grant execute on function public.admin_record_failed_login(uuid, inet) to service_role;

-- ============================================================
-- 6) Admin session validation (used by middleware)
-- ============================================================
create or replace function public.admin_validate_session(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
  v_role text;
begin
  select admin_session_expires_at, role into v_expires, v_role
  from public.profiles where id = p_user_id;

  if v_role <> 'admin' then
    return false;
  end if;

  if v_expires is not null and v_expires < now() then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.admin_validate_session(uuid) to anon, authenticated, service_role;

-- ============================================================
-- 7) Password policy helper (90-day rotation for admins)
-- ============================================================
create or replace function public.admin_password_expired(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed timestamptz;
  v_role text;
begin
  select password_changed_at, role into v_changed, v_role
  from public.profiles where id = p_user_id;

  if v_role <> 'admin' then
    return false;
  end if;

  return (now() - v_changed) > interval '90 days';
end;
$$;

grant execute on function public.admin_password_expired(uuid) to anon, authenticated, service_role;