-- ============================================================
-- Weekly admin report log
-- ============================================================

create table if not exists public.weekly_report_log (
  id bigserial primary key,
  report_week date not null unique,
  payload jsonb not null,
  sent_to uuid[] not null default '{}',
  status text not null default 'sent',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists weekly_report_log_week_idx on public.weekly_report_log (report_week desc);

alter table public.weekly_report_log enable row level security;

drop policy if exists weekly_report_log_admin_read on public.weekly_report_log;
create policy weekly_report_log_admin_read on public.weekly_report_log
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists weekly_report_log_admin_write on public.weekly_report_log;
create policy weekly_report_log_admin_write on public.weekly_report_log
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Helper: safe count for verification_requests (table may not exist yet)
create or replace function public.get_verification_pending_count()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    return (select count(*) from public.verification_requests where status = 'pending');
  exception when undefined_table then
    return 0;
  end;
end;
$$;

-- Helper: safe sum for requests price/budget (column may not exist)
create or replace function public.get_requests_revenue(v_week date)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sum numeric := 0;
begin
  begin
    select coalesce(sum(price), 0) into v_sum
    from public.requests
    where created_at >= v_week and created_at < v_week + interval '7 days';
  exception when undefined_column then
    begin
      select coalesce(sum(budget), 0) into v_sum
      from public.requests
      where created_at >= v_week and created_at < v_week + interval '7 days';
    exception when undefined_column then
      v_sum := 0;
    end;
  end;
  return v_sum;
end;
$$;

grant execute on function public.get_verification_pending_count() to anon, authenticated, service_role;
grant execute on function public.get_requests_revenue(date) to anon, authenticated, service_role;

-- ============================================================
-- RPC to generate and store weekly report
-- ============================================================
create or replace function public.generate_weekly_report(p_week_monday date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week date := coalesce(p_week_monday, (current_date - interval '6 days')::date - (extract(dow from current_date)::int || ' days')::interval);
  v_report jsonb;
  v_admins uuid[];
begin
  -- Collect admin user IDs
  select array_agg(id) into v_admins
  from public.profiles
  where role = 'admin' and is_banned = false;

  -- Build report JSON using helper functions for safety
  v_report := jsonb_build_object(
    'week', to_char(v_week, 'YYYY-"W"WW'),
    'week_start', v_week,
    'week_end', v_week + interval '6 days',
    'generated_at', now(),
    'summary', jsonb_build_object(
      'new_users', (select count(*) from public.profiles where created_at >= v_week and created_at < v_week + interval '7 days'),
      'total_users', (select count(*) from public.profiles),
      'active_users_7d', (select count(distinct user_id) from public.analytics_events where created_at >= v_week and created_at < v_week + interval '7 days' and user_id is not null),
      'reports_total', (select count(*) from public.reports where created_at >= v_week and created_at < v_week + interval '7 days'),
      'reports_pending', (select count(*) from public.reports where status = 'pending'),
      'verifications_pending', public.get_verification_pending_count(),
      'services_new', (select count(*) from public.services where created_at >= v_week and created_at < v_week + interval '7 days'),
      'requests_new', (select count(*) from public.requests where created_at >= v_week and created_at < v_week + interval '7 days'),
      'questions_new', (select count(*) from public.questions where created_at >= v_week and created_at < v_week + interval '7 days')
    ),
    'top_cities', (
      select jsonb_agg(jsonb_build_object('city', city, 'count', cnt) order by cnt desc)
      from (
        select coalesce(city, 'غير محدد') as city, count(*) as cnt
        from public.profiles
        where created_at >= v_week and created_at < v_week + interval '7 days'
        group by city
        order by cnt desc
        limit 10
      ) t
    ),
    'revenue_estimate', jsonb_build_object(
      'services', (select coalesce(sum(price_from), 0) from public.services where created_at >= v_week and created_at < v_week + interval '7 days'),
      'requests', public.get_requests_revenue(v_week)
    ),
    'funnel', (
      select jsonb_agg(jsonb_build_object('step', step, 'count', count) order by
        case step
          when 'landing' then 1
          when 'search' then 2
          when 'service_view' then 3
          when 'request_start' then 4
          when 'service_book' then 5
          when 'request_complete' then 6
          else 99
        end)
      from public.analytics_funnel_daily
      where date >= v_week and date < v_week + interval '7 days'
    ),
    'retention', (
      select jsonb_agg(jsonb_build_object('week', week_number, 'rate', retention_rate) order by week_number)
      from public.analytics_retention_weekly
      where cohort_week = v_week
    )
  );

  -- Store log
  insert into public.weekly_report_log (report_week, payload, sent_to, status)
  values (v_week, v_report, v_admins, 'sent')
  on conflict (report_week) do update set
    payload = excluded.payload,
    sent_to = excluded.sent_to,
    status = excluded.status,
    error_message = null;

  return v_report;
end;
$$;

grant execute on function public.generate_weekly_report(date) to service_role;