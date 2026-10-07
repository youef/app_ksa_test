-- Migration: 202610070002_admin_system_and_relationships.sql
-- Comprehensive, database-backed admin control center schema, tables, foreign keys, and secure RPC functions.

-- 1. Ensure columns exist on profiles
alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists role text not null default 'user';

-- 2. Reports table with explicit foreign keys for PostgREST joins
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null, -- 'user', 'question', 'answer', 'request', 'service'
  target_id uuid not null,
  reason text not null,
  status text not null default 'pending', -- 'pending', 'resolved', 'dismissed'
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 3. Verification Requests table with explicit foreign keys
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. Admin Activity Logs table
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 5. Custom Saudi Locations table
create table if not exists public.saudi_custom_locations (
  id uuid primary key default gen_random_uuid(),
  region_name text,
  city_name text,
  district_name text,
  latitude double precision,
  longitude double precision,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes for high-performance administrative filtering
create index if not exists idx_profiles_role_banned on public.profiles(role, is_banned);
create index if not exists idx_reports_status_created on public.reports(status, created_at desc);
create index if not exists idx_reports_reporter on public.reports(reporter_id);
create index if not exists idx_verifications_user on public.verification_requests(user_id);
create index if not exists idx_verifications_status on public.verification_requests(status, created_at desc);
create index if not exists idx_admin_logs_created on public.admin_activity_logs(created_at desc);
create index if not exists idx_admin_logs_actor on public.admin_activity_logs(actor_id);
create index if not exists idx_saudi_locations_names on public.saudi_custom_locations(region_name, city_name, district_name);

-- RLS Configuration
alter table public.reports enable row level security;
alter table public.verification_requests enable row level security;
alter table public.admin_activity_logs enable row level security;
alter table public.saudi_custom_locations enable row level security;

-- Reports policies
drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "Admins can view and manage all reports" on public.reports;
create policy "Admins can view and manage all reports"
  on public.reports for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or auth.uid() = reporter_id
  );

-- Verification requests policies
drop policy if exists "Users can submit own verification" on public.verification_requests;
create policy "Users can submit own verification"
  on public.verification_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Admins and owners can view verification requests" on public.verification_requests;
create policy "Admins and owners can view verification requests"
  on public.verification_requests for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or auth.uid() = user_id
  );

-- Admin activity logs policies
drop policy if exists "Admins can view and insert activity logs" on public.admin_activity_logs;
create policy "Admins can view and insert activity logs"
  on public.admin_activity_logs for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Saudi custom locations policies
drop policy if exists "Anyone can read custom locations" on public.saudi_custom_locations;
create policy "Anyone can read custom locations"
  on public.saudi_custom_locations for select
  to public
  using (true);

drop policy if exists "Admins can manage custom locations" on public.saudi_custom_locations;
create policy "Admins can manage custom locations"
  on public.saudi_custom_locations for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- =========================================================================
-- SECURE DATABASE-BACKED RPC FUNCTIONS
-- =========================================================================

-- Function 1: admin_update_user
create or replace function public.admin_update_user(
  p_target_user uuid,
  p_role text,
  p_is_verified boolean,
  p_is_geoverified boolean,
  p_is_banned boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.profiles;
  v_admin_count integer;
begin
  if v_actor is null or not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'user') then
    raise exception 'invalid role';
  end if;

  select * into v_target from public.profiles where id = p_target_user for update;
  if not found then
    raise exception 'user not found';
  end if;

  if p_target_user = v_actor and (p_role <> v_target.role or p_is_banned) then
    raise exception 'cannot remove your own admin access or ban yourself';
  end if;

  if v_target.role = 'admin' and p_role = 'user' then
    select count(*) into v_admin_count from public.profiles where role = 'admin' and not is_banned;
    if v_admin_count <= 1 then
      raise exception 'cannot demote the last active admin';
    end if;
  end if;

  update public.profiles
     set role = p_role,
         is_verified = coalesce(p_is_verified, false),
         verification_status = case when coalesce(p_is_verified, false) then 'verified' else 'unverified' end,
         is_geoverified = coalesce(p_is_geoverified, false),
         is_banned = coalesce(p_is_banned, false),
         updated_at = now()
   where id = p_target_user
   returning * into v_target;

  insert into public.admin_activity_logs(actor_id, action, target_type, target_id, metadata)
  values (
    v_actor,
    'تحديث حالة مستخدم',
    'user',
    p_target_user,
    jsonb_build_object('role', p_role, 'is_verified', p_is_verified, 'is_geoverified', p_is_geoverified, 'is_banned', p_is_banned)
  );

  return v_target;
end;
$$;

-- Function 2: admin_moderate_report
create or replace function public.admin_moderate_report(
  p_report_id uuid,
  p_action text,
  p_delete_content boolean default false
)
returns public.reports
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_report public.reports;
begin
  if v_actor is null or not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_action not in ('resolved', 'dismissed') then
    raise exception 'invalid report action';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found';
  end if;

  if p_delete_content then
    case v_report.target_type
      when 'question' then
        delete from public.questions where id = v_report.target_id;
      when 'answer' then
        delete from public.answers where id = v_report.target_id;
      when 'request' then
        delete from public.requests where id = v_report.target_id;
      when 'service' then
        delete from public.services where id = v_report.target_id;
      when 'borrow_item' then
        delete from public.borrow_items where id = v_report.target_id;
      when 'urgent_alert' then
        delete from public.urgent_alerts where id = v_report.target_id;
      else
        null;
    end case;
  end if;

  update public.reports
     set status = p_action,
         reviewed_by = v_actor,
         reviewed_at = now()
   where id = p_report_id
   returning * into v_report;

  insert into public.admin_activity_logs(actor_id, action, target_type, target_id, metadata)
  values (
    v_actor,
    case when p_delete_content then 'حذف محتوى مخالف وإغلاق البلاغ' else 'تحديث حالة بلاغ' end,
    'report',
    p_report_id,
    jsonb_build_object('status', p_action, 'deleted_content', p_delete_content)
  );

  return v_report;
end;
$$;

-- Function 3: admin_update_platform_entity
create or replace function public.admin_update_platform_entity(
  p_entity text,
  p_target_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_entity = 'service' and p_action = 'toggle_verified' then
    update public.services
       set is_verified = not coalesce(is_verified, false)
     where id = p_target_id
     returning to_jsonb(services.*) into v_result;

  elsif p_entity = 'service' and p_action = 'toggle_available' then
    update public.services
       set available_now = not coalesce(available_now, false)
     where id = p_target_id
     returning to_jsonb(services.*) into v_result;

  elsif p_entity = 'borrow_item' and p_action = 'toggle_status' then
    update public.borrow_items
       set status = case when status = 'available' then 'unavailable' else 'available' end,
           updated_at = now()
     where id = p_target_id
     returning to_jsonb(borrow_items.*) into v_result;

  elsif p_entity = 'urgent_alert' and p_action = 'resolve' then
    update public.urgent_alerts
       set status = 'resolved',
           resolved_at = now()
     where id = p_target_id
     returning to_jsonb(urgent_alerts.*) into v_result;

  elsif p_entity = 'urgent_alert' and p_action = 'delete' then
    delete from public.urgent_alerts where id = p_target_id;
    v_result := jsonb_build_object('deleted', true, 'id', p_target_id);

  elsif p_entity = 'request' and p_action = 'close' then
    update public.requests
       set status = 'closed'
     where id = p_target_id
     returning to_jsonb(requests.*) into v_result;

  elsif p_entity = 'question' and p_action = 'close' then
    update public.questions
       set status = 'closed'
     where id = p_target_id
     returning to_jsonb(questions.*) into v_result;

  else
    raise exception 'unsupported platform entity action: % on %', p_action, p_entity;
  end if;

  if v_result is null then
    raise exception 'platform entity not found';
  end if;

  insert into public.admin_activity_logs(actor_id, action, target_type, target_id, metadata)
  values (
    v_actor,
    'تعديل مورد من موارد المنصة',
    p_entity,
    p_target_id,
    jsonb_build_object('action', p_action)
  );

  return v_result;
end;
$$;

-- Grant execution permissions to authenticated users
revoke all on function public.admin_update_user(uuid, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_update_user(uuid, text, boolean, boolean, boolean) to authenticated;

revoke all on function public.admin_moderate_report(uuid, text, boolean) from public, anon;
grant execute on function public.admin_moderate_report(uuid, text, boolean) to authenticated;

revoke all on function public.admin_update_platform_entity(text, uuid, text) from public, anon;
grant execute on function public.admin_update_platform_entity(text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
