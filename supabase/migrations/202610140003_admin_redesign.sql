-- ============================================================
-- Admin redesign support RPCs (202610140003)
-- Admin-guarded wrappers so the command center can trigger
-- privileged operations from the client without service_role.
-- Safe to run repeatedly (idempotent).
-- ============================================================

-- Guard helper: raises if the caller is not an active admin.
create or replace function public.assert_is_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_banned = false
  ) then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.assert_is_admin() to authenticated;

-- ------------------------------------------------------------
-- 1) Reset failed login attempts for a user (admin only)
-- ------------------------------------------------------------
create or replace function public.admin_reset_user_login_attempts(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_is_admin();
  update public.profiles
  set failed_login_attempts = 0,
      last_failed_login_at = null
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_reset_user_login_attempts(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2) Generate the weekly report from the client (admin only)
--    Delegates to generate_weekly_report() which is normally
--    restricted to service_role.
-- ------------------------------------------------------------
create or replace function public.admin_generate_weekly_report(p_week_monday date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_is_admin();
  return public.generate_weekly_report(p_week_monday);
end;
$$;

grant execute on function public.admin_generate_weekly_report(date) to authenticated;

-- ------------------------------------------------------------
-- 3) Lightweight platform health snapshot (admin only)
-- ------------------------------------------------------------
create or replace function public.admin_platform_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.assert_is_admin();
  v := jsonb_build_object(
    'generated_at', now(),
    'db_time', now(),
    'tables', (
      select jsonb_object_agg(t.name, t.cnt)
      from (
        select 'profiles' as name, count(*)::bigint as cnt from public.profiles
        union all select 'services', count(*) from public.services
        union all select 'requests', count(*) from public.requests
        union all select 'questions', count(*) from public.questions
        union all select 'reports', count(*) from public.reports
      ) t
    )
  );
  return v;
exception when undefined_table then
  perform public.assert_is_admin();
  return jsonb_build_object('generated_at', now(), 'db_time', now(), 'tables', '{}'::jsonb);
end;
$$;

grant execute on function public.admin_platform_health() to authenticated;

-- Refresh PostgREST schema cache so the new RPCs are callable immediately.
notify pgrst, 'reload schema';
