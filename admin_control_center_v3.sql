-- Admin Control Center v3
-- Safe, database-backed admin operations for Hayna.

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

alter table public.reports
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

create index if not exists idx_profiles_role_banned on public.profiles(role, is_banned);
create index if not exists idx_reports_status_created_at on public.reports(status, created_at desc);
create index if not exists idx_admin_activity_logs_created_at on public.admin_activity_logs(created_at desc);

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
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
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
  if not found then raise exception 'user not found'; end if;
  if p_target_user = v_actor and (p_role <> v_target.role or p_is_banned) then
    raise exception 'cannot remove your own admin access or ban yourself';
  end if;
  if v_target.role = 'admin' and p_role = 'user' then
    select count(*) into v_admin_count from public.profiles where role = 'admin' and not is_banned;
    if v_admin_count <= 1 then raise exception 'cannot demote the last active admin'; end if;
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
  values (v_actor, 'تحديث حالة مستخدم', 'user', p_target_user,
          jsonb_build_object('role', p_role, 'is_verified', p_is_verified, 'is_geoverified', p_is_geoverified, 'is_banned', p_is_banned));
  return v_target;
end;
$$;

create or replace function public.admin_moderate_report(
  p_report_id uuid,
  p_action text,
  p_delete_content boolean default false
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_report public.reports;
begin
  if v_actor is null or not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_action not in ('resolved', 'dismissed') then raise exception 'invalid report action'; end if;
  select * into v_report from public.reports where id = p_report_id for update;
  if not found then raise exception 'report not found'; end if;
  if p_delete_content then
    case v_report.target_type
      when 'question' then delete from public.questions where id = v_report.target_id;
      when 'answer' then delete from public.answers where id = v_report.target_id;
      when 'request' then delete from public.requests where id = v_report.target_id;
      when 'service' then delete from public.services where id = v_report.target_id;
      else raise exception 'unsupported report target';
    end case;
  end if;
  update public.reports
     set status = p_action, reviewed_by = v_actor, reviewed_at = now()
   where id = p_report_id
   returning * into v_report;
  insert into public.admin_activity_logs(actor_id, action, target_type, target_id, metadata)
  values (v_actor, case when p_delete_content then 'حذف محتوى مخالف' else 'تحديث حالة بلاغ' end,
          'report', p_report_id, jsonb_build_object('status', p_action, 'deleted_content', p_delete_content));
  return v_report;
end;
$$;

revoke all on function public.admin_update_user(uuid, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_update_user(uuid, text, boolean, boolean, boolean) to authenticated;
revoke all on function public.admin_moderate_report(uuid, text, boolean) from public, anon;
grant execute on function public.admin_moderate_report(uuid, text, boolean) to authenticated;
