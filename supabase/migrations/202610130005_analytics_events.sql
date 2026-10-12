-- ============================================================
-- Analytics events for funnels, heatmaps, retention
-- ============================================================

create table if not exists public.analytics_events (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid, -- client-generated session ID
  event_name text not null, -- 'page_view', 'service_click', 'request_start', 'request_complete', 'service_book', 'search', 'filter_apply'
  entity_type text, -- 'service', 'request', 'question', 'category'
  entity_id uuid,
  properties jsonb default '{}'::jsonb, -- flexible: {city, category, price, source, ...}
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_entity_idx
  on public.analytics_events (entity_type, entity_id, created_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id, created_at);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_admin_read on public.analytics_events;
create policy analytics_events_admin_read on public.analytics_events
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert on public.analytics_events
  for insert with check (true); -- client/Edge inserts

-- Partition by month for performance (optional, run manually when table grows)
-- create table public.analytics_events_2026_10 partition of public.analytics_events for values from ('2026-10-01') to ('2026-11-01');

-- ============================================================
-- Aggregated tables for fast dashboard reads
-- ============================================================

-- Daily active users
create table if not exists public.analytics_dau (
  date date primary key,
  dau int not null default 0,
  mau int not null default 0,
  new_users int not null default 0,
  returning_users int not null default 0,
  created_at timestamptz not null default now()
);

-- Funnel steps (pre-computed daily)
create table if not exists public.analytics_funnel_daily (
  date date not null,
  step text not null, -- 'landing', 'search', 'service_view', 'request_start', 'request_complete', 'service_book'
  count int not null default 0,
  unique (date, step)
);

-- Retention cohorts (weekly)
create table if not exists public.analytics_retention_weekly (
  cohort_week date not null, -- Monday of cohort week
  week_number int not null, -- 0 = cohort week, 1 = week 1, etc.
  cohort_size int not null default 0,
  retained_count int not null default 0,
  retention_rate real generated always as (case when cohort_size > 0 then retained_count::real / cohort_size else 0 end) stored,
  primary key (cohort_week, week_number)
);

-- Revenue estimates daily
create table if not exists public.analytics_revenue_daily (
  date date primary key,
  services_estimated_revenue numeric(12,2) not null default 0,
  requests_estimated_budget numeric(12,2) not null default 0,
  total_estimated numeric(12,2) generated always as (services_estimated_revenue + requests_estimated_budget) stored,
  created_at timestamptz not null default now()
);

-- Heatmap aggregates (city/district + entity type)
create table if not exists public.analytics_heatmap_daily (
  date date not null,
  city text not null,
  district text,
  entity_type text not null, -- 'service', 'request', 'report'
  count int not null default 0,
  primary key (date, city, district, entity_type)
);

-- Enable RLS on all analytics aggregates (admin read only)
alter table public.analytics_dau enable row level security;
alter table public.analytics_funnel_daily enable row level security;
alter table public.analytics_retention_weekly enable row level security;
alter table public.analytics_revenue_daily enable row level security;
alter table public.analytics_heatmap_daily enable row level security;

drop policy if exists analytics_agg_admin_read on public.analytics_dau;
create policy analytics_agg_admin_read on public.analytics_dau
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists analytics_funnel_admin_read on public.analytics_funnel_daily;
create policy analytics_funnel_admin_read on public.analytics_funnel_daily
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists analytics_retention_admin_read on public.analytics_retention_weekly;
create policy analytics_retention_admin_read on public.analytics_retention_weekly
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists analytics_revenue_admin_read on public.analytics_revenue_daily;
create policy analytics_revenue_admin_read on public.analytics_revenue_daily
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists analytics_heatmap_admin_read on public.analytics_heatmap_daily;
create policy analytics_heatmap_admin_read on public.analytics_heatmap_daily
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- RPCs for analytics computations (called by Edge Functions)
-- ============================================================

-- Compute DAU/MAU for a date
create or replace function public.compute_dau(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dau int;
  v_mau int;
  v_new int;
  v_returning int;
begin
  -- DAU: distinct users with any event on p_date
  select count(distinct user_id) into v_dau
  from public.analytics_events
  where created_at >= p_date and created_at < p_date + interval '1 day'
    and user_id is not null;

  -- MAU: distinct users with any event in last 30 days
  select count(distinct user_id) into v_mau
  from public.analytics_events
  where created_at >= p_date - interval '29 days' and created_at < p_date + interval '1 day'
    and user_id is not null;

  -- New users: first event ever on p_date
  select count(distinct user_id) into v_new
  from public.analytics_events e
  where e.created_at >= p_date and e.created_at < p_date + interval '1 day'
    and e.user_id is not null
    and not exists (
      select 1 from public.analytics_events e2
      where e2.user_id = e.user_id and e2.created_at < p_date
    );

  v_returning := v_dau - v_new;

  insert into public.analytics_dau (date, dau, mau, new_users, returning_users)
  values (p_date, v_dau, v_mau, v_new, v_returning)
  on conflict (date) do update set
    dau = excluded.dau,
    mau = excluded.mau,
    new_users = excluded.new_users,
    returning_users = excluded.returning_users;
end;
$$;

-- Compute funnel steps for a date
create or replace function public.compute_funnel_daily(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_funnel_daily (date, step, count)
  select
    p_date as date,
    e.event_name as step,
    count(*) as count
  from public.analytics_events e
  where e.created_at >= p_date and e.created_at < p_date + interval '1 day'
    and e.event_name in ('landing', 'search', 'service_view', 'request_start', 'request_complete', 'service_book')
  group by e.event_name
  on conflict (date, step) do update set count = excluded.count;
end;
$$;

-- Compute retention cohorts (run weekly for previous week)
create or replace function public.compute_retention_weekly(p_cohort_week date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort_size int;
  v_week record;
begin
  -- Cohort size: users with first event in cohort week (Mon-Sun)
  select count(distinct user_id) into v_cohort_size
  from public.analytics_events
  where created_at >= p_cohort_week and created_at < p_cohort_week + interval '7 days'
    and user_id is not null
    and not exists (
      select 1 from public.analytics_events e2
      where e2.user_id = analytics_events.user_id and e2.created_at < p_cohort_week
    );

  -- Week 0 (cohort week itself)
  insert into public.analytics_retention_weekly (cohort_week, week_number, cohort_size, retained_count)
  values (p_cohort_week, 0, v_cohort_size, v_cohort_size)
  on conflict (cohort_week, week_number) do update set cohort_size = excluded.cohort_size, retained_count = excluded.retained_count;

  -- Weeks 1-12
  for v_week in
    select generate_series(1, 12) as week_num
  loop
    insert into public.analytics_retention_weekly (cohort_week, week_number, cohort_size, retained_count)
    select
      p_cohort_week,
      v_week.week_num,
      v_cohort_size,
      count(distinct e.user_id)
    from public.analytics_events e
    where e.user_id in (
      select distinct user_id from public.analytics_events
      where created_at >= p_cohort_week and created_at < p_cohort_week + interval '7 days'
        and user_id is not null
        and not exists (
          select 1 from public.analytics_events e2
          where e2.user_id = analytics_events.user_id and e2.created_at < p_cohort_week
        )
    )
    and e.created_at >= p_cohort_week + (v_week.week_num || ' weeks')::interval
    and e.created_at < p_cohort_week + ((v_week.week_num + 1) || ' weeks')::interval
    on conflict (cohort_week, week_number) do update set
      cohort_size = excluded.cohort_size,
      retained_count = excluded.retained_count;
  end loop;
end;
$$;

-- Compute revenue estimates for a date
create or replace function public.compute_revenue_daily(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_services numeric;
  v_requests numeric;
begin
  -- Services: sum of price_from for services created that day (rough estimate)
  select coalesce(sum(price_from), 0) into v_services
  from public.services
  where created_at >= p_date and created_at < p_date + interval '1 day'
    and price_from is not null;

  -- Requests: sum of budget for requests created that day
  select coalesce(sum(budget), 0) into v_requests
  from public.requests
  where created_at >= p_date and created_at < p_date + interval '1 day'
    and budget is not null;

  insert into public.analytics_revenue_daily (date, services_estimated_revenue, requests_estimated_budget)
  values (p_date, v_services, v_requests)
  on conflict (date) do update set
    services_estimated_revenue = excluded.services_estimated_revenue,
    requests_estimated_budget = excluded.requests_estimated_budget;
end;
$$;

-- Compute heatmap for a date
create or replace function public.compute_heatmap_daily(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Services
  insert into public.analytics_heatmap_daily (date, city, district, entity_type, count)
  select p_date, coalesce(city, 'غير محدد'), district, 'service', count(*)
  from public.services
  where created_at >= p_date and created_at < p_date + interval '1 day'
  group by city, district
  on conflict (date, city, district, entity_type) do update set count = excluded.count;

  -- Requests
  insert into public.analytics_heatmap_daily (date, city, district, entity_type, count)
  select p_date, coalesce(city, 'غير محدد'), district, 'request', count(*)
  from public.requests
  where created_at >= p_date and created_at < p_date + interval '1 day'
  group by city, district
  on conflict (date, city, district, entity_type) do update set count = excluded.count;

  -- Reports
  insert into public.analytics_heatmap_daily (date, city, district, entity_type, count)
  select p_date, coalesce(city, 'غير محدد'), district, 'report', count(*)
  from public.reports r
  join public.profiles p on r.target_id = p.id
  where r.created_at >= p_date and r.created_at < p_date + interval '1 day'
  group by p.city, p.district
  on conflict (date, city, district, entity_type) do update set count = excluded.count;
end;
$$;

grant execute on function public.compute_dau(date) to service_role;
grant execute on function public.compute_funnel_daily(date) to service_role;
grant execute on function public.compute_retention_weekly(date) to service_role;
grant execute on function public.compute_revenue_daily(date) to service_role;
grant execute on function public.compute_heatmap_daily(date) to service_role;

-- ============================================================
-- Client-side event logging helper (call from React Native)
-- ============================================================
create or replace function public.log_analytics_event(
  p_event_name text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_properties jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_events (user_id, event_name, entity_type, entity_id, properties)
  values (auth.uid(), p_event_name, p_entity_type, p_entity_id, p_properties);
end;
$$;

grant execute on function public.log_analytics_event(text, text, uuid, jsonb) to authenticated, anon;