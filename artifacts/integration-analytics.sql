-- Systems 4-9: authenticated, minimal telemetry and truthful aggregated reports.
-- Tested in an isolated PostgreSQL runtime before any production application.
-- Depends on existing analytics tables and public.hayna_has_permission(text).
create schema if not exists app_private;

alter table public.analytics_events add column if not exists dedupe_key text;
alter table public.analytics_events add column if not exists city text;
alter table public.analytics_events add column if not exists district text;
create unique index if not exists analytics_events_actor_dedupe_idx
 on public.analytics_events(user_id,dedupe_key) where dedupe_key is not null;
create index if not exists analytics_events_created_actor_idx on public.analytics_events(created_at,user_id);
create index if not exists analytics_events_area_day_idx on public.analytics_events(city,district,created_at) where city is not null;
alter table public.analytics_heatmap_daily add column if not exists active_users integer not null default 0;
alter table public.analytics_revenue_daily add column if not exists confirmed_revenue numeric(14,2) not null default 0;
alter table public.analytics_revenue_daily add column if not exists refunded_amount numeric(14,2) not null default 0;
alter table public.analytics_revenue_daily add column if not exists fees_amount numeric(14,2);
alter table public.analytics_revenue_daily add column if not exists net_revenue numeric(14,2);
alter table public.analytics_revenue_daily add column if not exists transaction_count integer not null default 0;
alter table public.analytics_revenue_daily add column if not exists source_available boolean not null default false;
alter table public.analytics_revenue_daily add column if not exists sources jsonb not null default '{}'::jsonb;

-- Raw telemetry is not an individual-user report API. Clients write through one bounded RPC only.
revoke all on public.analytics_events from anon,authenticated;
revoke all on public.analytics_dau,public.analytics_funnel_daily,public.analytics_retention_weekly,
 public.analytics_revenue_daily,public.analytics_heatmap_daily from anon,authenticated;
grant select on public.analytics_dau,public.analytics_funnel_daily,public.analytics_retention_weekly,
 public.analytics_revenue_daily,public.analytics_heatmap_daily to authenticated;
do $block$
declare t text; p record;
begin
 foreach t in array array['analytics_events','analytics_dau','analytics_funnel_daily','analytics_retention_weekly','analytics_revenue_daily','analytics_heatmap_daily'] loop
  execute format('alter table public.%I enable row level security',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  if t<>'analytics_events' then
   execute format('create policy analytics_permission_read on public.%I for select to authenticated using ((select public.hayna_has_permission(''analytics'')))',t);
  end if;
 end loop;
end $block$;

create or replace function app_private.analytics_write(
 p_actor uuid,p_name text,p_key text,p_entity_type text default null,p_entity_id uuid default null,
 p_properties jsonb default '{}'::jsonb,p_session uuid default null)
returns boolean language plpgsql security definer set search_path=pg_catalog
as $fn$
declare loc record; changed integer;
begin
 if p_actor is null or p_name not in ('app_open','authenticated','account_created','location_set','home_view','section_open','content_created','first_content_created','content_interacted','app_return') then return false; end if;
 select nullif(btrim(city),'') city,nullif(btrim(district),'') district into loc from public.profiles where id=p_actor and not coalesce(is_banned,false);
 if not found then return false; end if;
 insert into public.analytics_events(user_id,session_id,event_name,entity_type,entity_id,properties,dedupe_key,city,district)
 values(p_actor,p_session,p_name,p_entity_type,p_entity_id,coalesce(p_properties,'{}'::jsonb),left(p_key,180),
  case when loc.city not in ('كل المدن','كل المملكة','جميع المدن','الكل') then loc.city end,
  case when loc.district not in ('كل الأحياء','كل أحياء المدينة','جميع الأحياء','الكل') then loc.district end)
 on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
 get diagnostics changed=row_count;
 return changed=1;
end $fn$;
revoke all on function app_private.analytics_write(uuid,text,text,text,uuid,jsonb,uuid) from public,anon,authenticated;

-- Existing permissive helper now delegates only supported navigation events to the validated API.
create or replace function public.hayna_record_analytics(
 p_event_name text,p_event_key text,p_properties jsonb default '{}'::jsonb,p_session_id uuid default null)
returns boolean language plpgsql security definer set search_path=pg_catalog
as $fn$
declare actor uuid:=auth.uid(); section_name text; canonical_key text; local_day text; recorded boolean;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_event_name not in ('app_open','authenticated','home_view','section_open','app_return') then
  raise exception 'Unsupported analytics event' using errcode='22023';
 end if;
 if p_event_key is null or length(p_event_key)>100 or p_event_key !~ '^[a-zA-Z0-9:_-]+$' then
  raise exception 'Invalid event key' using errcode='22023';
 end if;
 if jsonb_typeof(p_properties)<>'object' or pg_column_size(p_properties)>512 or
  exists(select 1 from jsonb_object_keys(p_properties) k where k not in ('section')) then
  raise exception 'Unsupported analytics properties' using errcode='22023';
 end if;
 section_name:=p_properties->>'section';
 if p_event_name<>'section_open' and section_name is not null then raise exception 'Unexpected section' using errcode='22023'; end if;
 if section_name is not null and section_name not in ('home','questions','requests','market','stories','tools','events','explore','profile','other') then
  raise exception 'Invalid section' using errcode='22023';
 end if;
 if p_event_name='section_open' and section_name is null then raise exception 'Section required' using errcode='22023'; end if;
 local_day:=(now() at time zone 'Asia/Riyadh')::date::text;
 -- A navigation bucket is recorded once per actor and local day, across rerenders/reloads/devices.
 canonical_key:='navigation:'||local_day||':'||p_event_name||':'||coalesce(section_name,'');
 if p_event_name='app_return' and not exists(select 1 from public.analytics_events where user_id=actor and created_at<((now() at time zone 'Asia/Riyadh')::date::timestamp at time zone 'Asia/Riyadh')) then return false; end if;
 recorded:=app_private.analytics_write(actor,p_event_name,canonical_key,null,null,
  case when section_name is null then '{}'::jsonb else jsonb_build_object('section',section_name) end,p_session_id);
 if p_event_name='authenticated' and exists(select 1 from public.profiles where id=actor and nullif(btrim(city),'') is not null and nullif(btrim(district),'') is not null and city not in ('كل المدن','كل المملكة','جميع المدن','الكل') and district not in ('كل الأحياء','كل أحياء المدينة','جميع الأحياء','الكل')) then
  perform app_private.analytics_write(actor,'location_set','location-ready:'||local_day,null,null,'{}'::jsonb,p_session_id);
 end if;
 return recorded;
end $fn$;
revoke all on function public.hayna_record_analytics(text,text,jsonb,uuid) from public,anon;
grant execute on function public.hayna_record_analytics(text,text,jsonb,uuid) to authenticated;

create or replace function public.log_analytics_event(p_event_name text,p_entity_type text default null,p_entity_id uuid default null,p_properties jsonb default '{}'::jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog
as $fn$
begin
 if p_entity_type is not null or p_entity_id is not null then raise exception 'Use server content events' using errcode='22023'; end if;
 perform public.hayna_record_analytics(p_event_name,'legacy:'||p_event_name,p_properties,null);
end $fn$;
revoke all on function public.log_analytics_event(text,text,uuid,jsonb) from public,anon;
grant execute on function public.log_analytics_event(text,text,uuid,jsonb) to authenticated;

create or replace function app_private.analytics_content_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $fn$
declare rowdata jsonb:=to_jsonb(new); actor uuid; item uuid; category text; action_name text; prior boolean;
begin
 if tg_table_name in ('questions','requests','stories','services','marketplace_items') then
  actor:=coalesce(rowdata->>'author_id',rowdata->>'requester_id',rowdata->>'provider_id',rowdata->>'seller_id')::uuid;
  item:=(rowdata->>'id')::uuid;
  category:=case tg_table_name when 'questions' then 'question' when 'requests' then 'request' when 'stories' then 'story' when 'services' then 'service' else 'product' end;
  perform app_private.analytics_write(actor,'content_created','created:'||category||':'||item,category,item,'{}'::jsonb,null);
  if tg_table_name in ('questions','requests') then
   -- Serializes concurrent first posts by one actor without locking unrelated users.
   perform pg_advisory_xact_lock(hashtextextended('analytics-first:'||actor::text,0));
   prior:=exists(select 1 from public.analytics_events where user_id=actor and event_name='first_content_created');
   if not prior then
    -- Existing pre-instrumentation content means this is not their first contribution.
    prior:=exists(select 1 from public.questions where author_id=actor and (tg_table_name<>'questions' or id<>item))
     or exists(select 1 from public.requests where requester_id=actor and (tg_table_name<>'requests' or id<>item));
    if not prior then perform app_private.analytics_write(actor,'first_content_created','first-content',category,item,'{}'::jsonb,null); end if;
   end if;
  end if;
 else
  actor:=coalesce(rowdata->>'user_id',rowdata->>'author_id')::uuid;
  item:=coalesce(rowdata->>'question_id',rowdata->>'story_id',rowdata->>'request_id')::uuid;
  category:=case when rowdata?'story_id' then 'story' when rowdata?'request_id' then 'request' else 'question' end;
  action_name:=case when tg_table_name='answers' then 'answer' else 'like' end;
  perform app_private.analytics_write(actor,'content_interacted','interaction:'||tg_table_name||':'||item::text||':'||actor::text||':'||coalesce(rowdata->>'id',''),category,item,jsonb_build_object('action',action_name),null);
 end if;
 return new;
end $fn$;
revoke all on function app_private.analytics_content_trigger() from public,anon,authenticated;
do $block$
declare t text;
begin
 foreach t in array array['questions','requests','stories','services','marketplace_items','answers','question_likes','story_likes'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists zz_hayna_analytics_insert on public.%I',t);
   execute format('create trigger zz_hayna_analytics_insert after insert on public.%I for each row execute function app_private.analytics_content_trigger()',t);
  end if;
 end loop;
end $block$;

create or replace function app_private.analytics_profile_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $fn$
begin
 if tg_op='INSERT' then
  perform app_private.analytics_write(new.id,'account_created','account-created',null,null,'{}'::jsonb,null);
 end if;
 if nullif(btrim(new.city),'') is not null and nullif(btrim(new.district),'') is not null and new.city not in ('كل المدن','كل المملكة','جميع المدن','الكل') and new.district not in ('كل الأحياء','كل أحياء المدينة','جميع الأحياء','الكل') then
  if tg_op='INSERT' then
   perform app_private.analytics_write(new.id,'location_set','location:'||md5(new.city||':'||new.district),null,null,'{}'::jsonb,null);
  elsif row(new.city,new.district) is distinct from row(old.city,old.district) then
   perform app_private.analytics_write(new.id,'location_set','location:'||md5(new.city||':'||new.district),null,null,'{}'::jsonb,null);
  end if;
 end if;
 return new;
end $fn$;
revoke all on function app_private.analytics_profile_trigger() from public,anon,authenticated;
drop trigger if exists zz_hayna_analytics_profile on public.profiles;
create trigger zz_hayna_analytics_profile after insert or update of city,district on public.profiles
 for each row execute function app_private.analytics_profile_trigger();

create or replace function public.compute_dau(p_date date default (now() at time zone 'Asia/Riyadh')::date)
returns void language plpgsql security definer set search_path=pg_catalog
as $fn$
declare start_at timestamptz:=p_date::timestamp at time zone 'Asia/Riyadh'; end_at timestamptz:=(p_date+1)::timestamp at time zone 'Asia/Riyadh';
begin
 insert into public.analytics_dau(date,dau,mau,new_users,returning_users)
 select p_date,count(distinct e.user_id),
  (select count(distinct user_id) from public.analytics_events where created_at>=(p_date-29)::timestamp at time zone 'Asia/Riyadh' and created_at<end_at),
  count(distinct e.user_id) filter(where (p.created_at at time zone 'Asia/Riyadh')::date=p_date),
  count(distinct e.user_id) filter(where (p.created_at at time zone 'Asia/Riyadh')::date<p_date)
 from public.analytics_events e join public.profiles p on p.id=e.user_id where e.created_at>=start_at and e.created_at<end_at
 on conflict(date) do update set dau=excluded.dau,mau=excluded.mau,new_users=excluded.new_users,returning_users=excluded.returning_users;
end $fn$;

-- Each daily step counts distinct actors; the dashboard separately computes ordered period conversion.
create or replace function public.compute_funnel_daily(p_date date default (now() at time zone 'Asia/Riyadh')::date)
returns void language plpgsql security definer set search_path=pg_catalog
as $fn$
begin
 insert into public.analytics_funnel_daily(date,step,count)
 select p_date,step,count(distinct e.user_id)
 from unnest(array['app_open','authenticated','location_set','home_view','section_open','first_content_created','content_interacted','app_return']) step
 left join public.analytics_events e on e.event_name=step and e.created_at>=p_date::timestamp at time zone 'Asia/Riyadh' and e.created_at<(p_date+1)::timestamp at time zone 'Asia/Riyadh'
 group by step on conflict(date,step) do update set count=excluded.count;
end $fn$;

create or replace function public.compute_retention_weekly(p_cohort_week date)
returns void language plpgsql security definer set search_path=pg_catalog
as $fn$
declare week_start date:=date_trunc('week',p_cohort_week)::date; today date:=(now() at time zone 'Asia/Riyadh')::date; w integer;
begin
 if week_start>today then return; end if;
 for w in 0..least(12,((today-week_start)/7)) loop
  insert into public.analytics_retention_weekly(cohort_week,week_number,cohort_size,retained_count)
  select week_start,w,count(*),count(*) filter(where exists(select 1 from public.analytics_events e where e.user_id=p.id and e.created_at>=(week_start+w*7)::timestamp at time zone 'Asia/Riyadh' and e.created_at<(week_start+(w+1)*7)::timestamp at time zone 'Asia/Riyadh'))
  from public.profiles p where p.created_at>=week_start::timestamp at time zone 'Asia/Riyadh' and p.created_at<(week_start+7)::timestamp at time zone 'Asia/Riyadh'
  on conflict(cohort_week,week_number) do update set cohort_size=excluded.cohort_size,retained_count=excluded.retained_count;
 end loop;
end $fn$;

create or replace function public.compute_revenue_daily(p_date date default (now() at time zone 'Asia/Riyadh')::date)
returns void language plpgsql security definer set search_path=pg_catalog
as $fn$
declare available boolean:=to_regclass('public.marketplace_orders') is not null and to_regclass('public.marketplace_payment_transactions') is not null; gross numeric:=0; refunds numeric:=0; total integer:=0; source_totals jsonb:='{}'::jsonb;
begin
 if available then
  -- Existing server-owned order + payment ledger are the only admissible source.
  -- DISTINCT order prevents retry/webhook ledger duplication. Never sum advertised prices/budgets.
  execute $q$
   with confirmed as (
    select distinct o.id,o.order_type,o.amount_halalas,o.status
    from public.marketplace_orders o where o.paid_at >= $1::timestamp at time zone 'Asia/Riyadh' and o.paid_at < ($1+1)::timestamp at time zone 'Asia/Riyadh'
     and o.status in ('paid','refunded') and exists(select 1 from public.marketplace_payment_transactions t where t.order_id=o.id and t.status in ('paid','refunded') and t.paid_at is not null and t.currency=o.currency and t.amount_halalas=o.amount_halalas)
   ), by_source as (select order_type,sum(amount_halalas)/100.0 amount from confirmed group by order_type)
   select coalesce((select sum(amount_halalas)/100.0 from confirmed),0),coalesce((select sum(amount_halalas)/100.0 from confirmed where status='refunded'),0),(select count(*) from confirmed),coalesce((select jsonb_object_agg(order_type,amount) from by_source),'{}'::jsonb)
  $q$ into gross,refunds,total,source_totals using p_date;
 end if;
 insert into public.analytics_revenue_daily(date,services_estimated_revenue,requests_estimated_budget,confirmed_revenue,refunded_amount,fees_amount,net_revenue,transaction_count,source_available,sources)
 values(p_date,0,0,gross,refunds,null,null,total,available,source_totals)
 on conflict(date) do update set services_estimated_revenue=0,requests_estimated_budget=0,confirmed_revenue=excluded.confirmed_revenue,refunded_amount=excluded.refunded_amount,fees_amount=null,net_revenue=null,transaction_count=excluded.transaction_count,source_available=excluded.source_available,sources=excluded.sources;
end $fn$;

create or replace function public.compute_heatmap_daily(p_date date default (now() at time zone 'Asia/Riyadh')::date)
returns void language plpgsql security definer set search_path=pg_catalog
as $fn$
begin
 -- Removing only derived rows for this date prevents stale clusters; no user content is deleted.
 delete from public.analytics_heatmap_daily where date=p_date;
 insert into public.analytics_heatmap_daily(date,city,district,entity_type,count,active_users)
 select p_date,city,district,'activity',count(*),count(distinct user_id)
 from public.analytics_events where created_at>=p_date::timestamp at time zone 'Asia/Riyadh' and created_at<(p_date+1)::timestamp at time zone 'Asia/Riyadh'
  and city is not null and district is not null
 group by city,district having count(distinct user_id)>=5;
end $fn$;

create or replace function app_private.refresh_analytics(p_days integer default 2)
returns void language plpgsql security definer set search_path=pg_catalog
as $fn$
declare d date; w date; today date:=(now() at time zone 'Asia/Riyadh')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('hayna-analytics-refresh',0));
 for d in select generate_series(today-(least(greatest(p_days,1),180)-1),today,interval '1 day')::date loop
  perform public.compute_dau(d); perform public.compute_funnel_daily(d); perform public.compute_revenue_daily(d); perform public.compute_heatmap_daily(d);
 end loop;
 for w in select generate_series(date_trunc('week',today-interval '90 days'),date_trunc('week',today),interval '7 days')::date loop perform public.compute_retention_weekly(w); end loop;
end $fn$;
revoke all on function app_private.refresh_analytics(integer) from public,anon,authenticated;

-- Ordered steps are measured within a reporting window, per authenticated user.
-- Returning is shown separately: it is a later-day behavior, not a prerequisite to posting.
create or replace function app_private.analytics_funnel(p_start timestamptz,p_end timestamptz)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $fn$
 with a as(select user_id,min(created_at) t from public.analytics_events where event_name='app_open' and created_at>=p_start and created_at<p_end group by user_id),
 b as(select a.user_id,min(e.created_at) t from a join public.analytics_events e on e.user_id=a.user_id and e.created_at>=a.t and e.created_at<p_end and e.event_name='authenticated' group by a.user_id),
 c as(select b.user_id,min(e.created_at) t from b join public.analytics_events e on e.user_id=b.user_id and e.created_at>=b.t and e.created_at<p_end and e.event_name='location_set' group by b.user_id),
 d as(select c.user_id,min(e.created_at) t from c join public.analytics_events e on e.user_id=c.user_id and e.created_at>=c.t and e.created_at<p_end and e.event_name='home_view' group by c.user_id),
 f as(select d.user_id,min(e.created_at) t from d join public.analytics_events e on e.user_id=d.user_id and e.created_at>=d.t and e.created_at<p_end and e.event_name='section_open' group by d.user_id),
 g as(select f.user_id,min(e.created_at) t from f join public.analytics_events e on e.user_id=f.user_id and e.created_at>=f.t and e.created_at<p_end and e.event_name='first_content_created' group by f.user_id),
 h as(select g.user_id,min(e.created_at) t from g join public.analytics_events e on e.user_id=g.user_id and e.created_at>=g.t and e.created_at<p_end and e.event_name='content_interacted' group by g.user_id)
 select jsonb_build_array(jsonb_build_object('step','app_open','count',(select count(*) from a)),jsonb_build_object('step','authenticated','count',(select count(*) from b)),jsonb_build_object('step','location_set','count',(select count(*) from c)),jsonb_build_object('step','home_view','count',(select count(*) from d)),jsonb_build_object('step','section_open','count',(select count(*) from f)),jsonb_build_object('step','first_content_created','count',(select count(*) from g)),jsonb_build_object('step','content_interacted','count',(select count(*) from h)),jsonb_build_object('step','app_return','count',(select count(distinct user_id) from public.analytics_events where event_name='app_return' and created_at>=p_start and created_at<p_end)));
$fn$;
revoke all on function app_private.analytics_funnel(timestamptz,timestamptz) from public,anon,authenticated;

create or replace function public.hayna_analytics_dashboard(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $fn$
declare today date:=(now() at time zone 'Asia/Riyadh')::date; start_day date; start_at timestamptz; end_at timestamptz; prev_at timestamptz; payload jsonb;
begin
 if not public.hayna_has_permission('analytics') then raise exception 'Analytics permission required' using errcode='42501'; end if;
 if p_days not in (7,30,90) then raise exception 'Invalid reporting range' using errcode='22023'; end if;
 start_day:=today-(p_days-1); start_at:=start_day::timestamp at time zone 'Asia/Riyadh'; end_at:=(today+1)::timestamp at time zone 'Asia/Riyadh'; prev_at:=(start_day-p_days)::timestamp at time zone 'Asia/Riyadh';
 perform app_private.refresh_analytics(p_days);
 select jsonb_build_object('timezone','Asia/Riyadh','generated_at',now(),'days',p_days,'active_definition','حساب مسجل نفّذ حدث استخدام مسموحًا؛ يُحسب مرة واحدة في يوم الرياض. لا يشمل الزوار غير المسجلين.',
 'summary',jsonb_build_object('active_users',(select count(distinct user_id) from public.analytics_events where created_at>=start_at and created_at<end_at),'previous_active_users',(select count(distinct user_id) from public.analytics_events where created_at>=prev_at and created_at<start_at),'new_accounts',(select count(*) from public.profiles where created_at>=start_at and created_at<end_at)),
 'dau',(select coalesce(jsonb_agg(jsonb_build_object('date',start_day+i,'dau',(select count(distinct user_id) from public.analytics_events where created_at>=(start_day+i)::timestamp at time zone 'Asia/Riyadh' and created_at<(start_day+i+1)::timestamp at time zone 'Asia/Riyadh')) order by i),'[]'::jsonb) from generate_series(0,p_days-1) i),
 'funnel',app_private.analytics_funnel(start_at,end_at),'previous_funnel',app_private.analytics_funnel(prev_at,start_at),
 'retention',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('complete',(r.cohort_week+(r.week_number+1)*7)<=today) order by cohort_week desc,week_number),'[]'::jsonb) from public.analytics_retention_weekly r where cohort_week>=date_trunc('week',today-interval '90 days')::date and cohort_week+week_number*7<=today),
 'revenue',(select coalesce(jsonb_agg(to_jsonb(r) order by date),'[]'::jsonb) from public.analytics_revenue_daily r where date>=start_day and date<=today),
 'revenue_available',to_regclass('public.marketplace_orders') is not null and to_regclass('public.marketplace_payment_transactions') is not null,
 'heatmap',(select coalesce(jsonb_agg(to_jsonb(h) order by h.count desc),'[]'::jsonb) from (select city,district,count(*) count,count(distinct user_id) active_users from public.analytics_events where created_at>=start_at and created_at<end_at and city is not null and district is not null group by city,district having count(distinct user_id)>=5 order by count(*) desc limit 100) h),
 'event_totals',(select coalesce(jsonb_object_agg(event_name,n),'{}'::jsonb) from(select event_name,count(*) n from public.analytics_events where created_at>=start_at and created_at<end_at group by event_name) t)
 ) into payload;
 return payload;
end $fn$;
revoke all on function public.hayna_analytics_dashboard(integer) from public,anon;
grant execute on function public.hayna_analytics_dashboard(integer) to authenticated;

-- Only server schedules/service-role can compute aggregates directly.
revoke all on function public.compute_dau(date),public.compute_funnel_daily(date),public.compute_retention_weekly(date),public.compute_revenue_daily(date),public.compute_heatmap_daily(date) from public,anon,authenticated;
grant execute on function public.compute_dau(date),public.compute_funnel_daily(date),public.compute_retention_weekly(date),public.compute_revenue_daily(date),public.compute_heatmap_daily(date) to service_role;

-- Use pg_cron where already installed; isolated tests can run refresh explicitly.
do $block$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  if not exists(select 1 from cron.job where jobname='hayna-analytics-refresh') then
   perform cron.schedule('hayna-analytics-refresh','15 * * * *','select app_private.refresh_analytics(2);');
  end if;
 end if;
end $block$;
