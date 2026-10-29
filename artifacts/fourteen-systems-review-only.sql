-- REVIEW ONLY: production application was rejected by automatic approval review.
-- This file is NOT an applied migration. Requires backup, rollback review and explicit approval.
begin;
-- Explicit existing assignments remain unchanged. No user is automatically promoted.
create schema if not exists app_private;
create or replace function app_private.hayna_user_has_permission(p_user uuid,p_permission text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
select coalesce(p_user is not null
  and p_permission in ('users','reports','content','market','events','broadcast','alerts','support','analytics','roles','config','verifications','search','logs','security')
  and exists(select 1 from public.profiles p where p.id=p_user and not coalesce(p.is_banned,false))
  and not exists(select 1 from public.admin_permissions x where x.admin_id=p_user and x.permission=p_permission and not x.enabled)
  and (exists(select 1 from public.admin_permissions x where x.admin_id=p_user and x.permission=p_permission and x.enabled)
    or exists(select 1 from public.admin_role_assignments a join public.admin_roles r on r.key=a.role_key
      where a.user_id=p_user and (r.permissions->>p_permission='true' or r.permissions->>'all'='true'))),false);
$$;
revoke all on function app_private.hayna_user_has_permission(uuid,text) from public,anon,authenticated;
create or replace function public.hayna_has_permission(p_permission text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select app_private.hayna_user_has_permission(auth.uid(),p_permission);
$$;
revoke all on function public.hayna_has_permission(text) from public;
grant execute on function public.hayna_has_permission(text) to anon,authenticated,service_role;

create or replace function public.hayna_my_admin_permissions() returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$
select jsonb_object_agg(p,public.hayna_has_permission(p)) from unnest(array[
 'users','reports','content','market','events','broadcast','alerts','support','analytics','roles','config','verifications','search','logs','security']) p;
$$;
revoke all on function public.hayna_my_admin_permissions() from public;
grant execute on function public.hayna_my_admin_permissions() to authenticated;

-- Direct permission writes are removed; only the audited RPC can mutate assignments.
revoke insert,update,delete,truncate,references,trigger on public.admin_roles,public.admin_role_assignments,public.admin_permissions from anon,authenticated;
revoke update,delete,truncate,references,trigger on public.admin_activity_logs from anon,authenticated;
do $$ declare t text; p record; begin
 foreach t in array array['admin_roles','admin_role_assignments','admin_permissions','admin_activity_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
 end loop;
end $$;
create policy hayna_roles_read on public.admin_roles for select to authenticated using (
 public.hayna_has_permission('roles') or exists(select 1 from public.admin_role_assignments a where a.user_id=(select auth.uid()) and a.role_key=key));
create policy hayna_assignments_read on public.admin_role_assignments for select to authenticated using(user_id=(select auth.uid()) or public.hayna_has_permission('roles'));
create policy hayna_permissions_read on public.admin_permissions for select to authenticated using(admin_id=(select auth.uid()) or public.hayna_has_permission('roles'));
create policy hayna_audit_read on public.admin_activity_logs for select to authenticated using(public.hayna_has_permission('logs'));
create policy hayna_audit_append on public.admin_activity_logs for insert to authenticated with check(actor_id=(select auth.uid()) and exists(select 1 from jsonb_each_text(public.hayna_my_admin_permissions()) x where x.value='true'));
grant select on public.admin_roles,public.admin_role_assignments,public.admin_permissions,public.admin_activity_logs to authenticated;
grant insert on public.admin_activity_logs to authenticated;

create or replace function public.hayna_assign_admin_role(p_user_id uuid,p_role_key text,p_enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.hayna_has_permission('roles') then raise exception 'permission_denied:roles' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(72109431);
 if not exists(select 1 from public.profiles where id=p_user_id and not coalesce(is_banned,false))
  or not exists(select 1 from public.admin_roles where key=p_role_key) or p_enabled is null then
  raise exception 'invalid_admin_assignment' using errcode='22023'; end if;
 if p_role_key='owner' and not p_enabled and exists(select 1 from public.admin_role_assignments where user_id=p_user_id and role_key='owner')
  and (select count(*) from public.admin_role_assignments a join public.profiles p on p.id=a.user_id where a.role_key='owner' and not coalesce(p.is_banned,false))<=1 then
  raise exception 'last_owner_required' using errcode='42501'; end if;
 if p_enabled then
  insert into public.admin_role_assignments(user_id,role_key,assigned_by) values(p_user_id,p_role_key,auth.uid()) on conflict(user_id,role_key) do nothing;
 else delete from public.admin_role_assignments where user_id=p_user_id and role_key=p_role_key; end if;
 insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata)
  values(auth.uid(),case when p_enabled then 'admin_role_assigned' else 'admin_role_revoked' end,'user',p_user_id,jsonb_build_object('role',p_role_key));
end $$;
revoke all on function public.hayna_assign_admin_role(uuid,text,boolean) from public,anon;
grant execute on function public.hayna_assign_admin_role(uuid,text,boolean) to authenticated;

create or replace function public.hayna_set_admin_permission(p_user_id uuid,p_permission text,p_enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.hayna_has_permission('roles') then raise exception 'permission_denied:roles' using errcode='42501'; end if;
 if p_permission not in ('users','reports','content','market','events','broadcast','alerts','support','analytics','roles','config','verifications','search','logs','security')
  or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'invalid_permission'; end if;
 perform pg_advisory_xact_lock(72109431);
 if p_permission='roles' and p_enabled=false and exists(select 1 from public.admin_role_assignments where user_id=p_user_id and role_key='owner') then
  raise exception 'owner_role_access_required' using errcode='42501'; end if;
 if p_enabled is null then delete from public.admin_permissions where admin_id=p_user_id and permission=p_permission;
 else insert into public.admin_permissions(admin_id,permission,enabled,updated_at) values(p_user_id,p_permission,p_enabled,now())
  on conflict(admin_id,permission) do update set enabled=excluded.enabled,updated_at=excluded.updated_at; end if;
 insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata)
  values(auth.uid(),'admin_permission_changed','user',p_user_id,jsonb_build_object('permission',p_permission,'enabled',p_enabled));
end $$;
revoke all on function public.hayna_set_admin_permission(uuid,text,boolean) from public,anon;
grant execute on function public.hayna_set_admin_permission(uuid,text,boolean) to authenticated;

-- Restrictive policies compose with the existing owner policies rather than overriding them.
do $$ declare row record; begin
 for row in select * from (values
  ('reports','reports','reporter_id'),('verification_requests','verifications','user_id'),
  ('support_tickets','support','user_id'),('app_config','config',null),
  ('admin_config_changes','logs',null),('admin_access_logs','security',null)
 ) v(tab,perm,owner_column) loop
  if to_regclass('public.'||row.tab) is not null then
   execute format('revoke truncate on public.%I from anon,authenticated',row.tab);
   execute format('drop policy if exists hayna_permission_scope on public.%I',row.tab);
   execute format('create policy hayna_permission_scope on public.%I as restrictive for all to authenticated using (%s) with check (%s)',row.tab,
    case when row.owner_column is null then format('public.hayna_has_permission(%L)',row.perm) else format('%I=(select auth.uid()) or public.hayna_has_permission(%L)',row.owner_column,row.perm) end,
    case when row.owner_column is null then format('public.hayna_has_permission(%L)',row.perm) else format('%I=(select auth.uid()) or public.hayna_has_permission(%L)',row.owner_column,row.perm) end);
  end if;
 end loop;
end $$;
-- app_config is intentionally readable publicly. Restrict only administrative writes.
drop policy if exists hayna_permission_scope on public.app_config;
create policy hayna_config_insert on public.app_config as restrictive for insert to authenticated with check(public.hayna_has_permission('config'));
create policy hayna_config_update on public.app_config as restrictive for update to authenticated using(public.hayna_has_permission('config')) with check(public.hayna_has_permission('config'));
create policy hayna_config_delete on public.app_config as restrictive for delete to authenticated using(public.hayna_has_permission('config'));

-- SECURITY DEFINER callers cannot bypass these privilege checks on sensitive profile fields.
create or replace function app_private.hayna_guard_admin_profile_fields() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then return new; end if;
 if new.role is distinct from old.role and not public.hayna_has_permission('roles') then raise exception 'permission_denied:roles' using errcode='42501'; end if;
 if new.is_banned is distinct from old.is_banned and not public.hayna_has_permission('users') then raise exception 'permission_denied:users' using errcode='42501'; end if;
 if (new.is_verified is distinct from old.is_verified or new.is_verified_merchant is distinct from old.is_verified_merchant
    or new.is_geoverified is distinct from old.is_geoverified)
   and not public.hayna_has_permission('verifications') then raise exception 'permission_denied:verifications' using errcode='42501'; end if;
 if (new.role is distinct from old.role or (new.is_banned and not coalesce(old.is_banned,false)))
   and exists(select 1 from public.admin_role_assignments where user_id=old.id and role_key='owner') then
   perform pg_advisory_xact_lock(72109431);
   if (select count(*) from public.admin_role_assignments a join public.profiles p on p.id=a.user_id where a.role_key='owner' and not coalesce(p.is_banned,false))<=1 then
    raise exception 'last_owner_required' using errcode='42501'; end if;
 end if;
 return new;
end $$;
drop trigger if exists aa_hayna_admin_profile_guard on public.profiles;
create trigger aa_hayna_admin_profile_guard before update on public.profiles for each row execute function app_private.hayna_guard_admin_profile_fields();
revoke all on function app_private.hayna_guard_admin_profile_fields() from public,anon,authenticated;

-- All administrative data changes are append-only audited, without private payloads.
create or replace function app_private.hayna_audit_admin_write() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare payload jsonb; target uuid; permission_key text:=tg_argv[0]; begin
 if auth.uid() is null or not public.hayna_has_permission(permission_key) then return coalesce(new,old); end if;
 payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 begin target:=(payload->>'id')::uuid; exception when invalid_text_representation then target:=null; end;
 insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata)
  values(auth.uid(),lower(tg_op),tg_table_name,target,jsonb_build_object('permission',permission_key));
 return coalesce(new,old);
end $$;
revoke all on function app_private.hayna_audit_admin_write() from public,anon,authenticated;
do $$ declare row record; begin
 for row in select * from(values('profiles','users'),('reports','reports'),('verification_requests','verifications'),('support_tickets','support'),('businesses','market'),('services','market'),('marketplace_items','market'),('events','events'),('app_config','config'),('scheduled_broadcasts','broadcast'),('urgent_alerts','alerts')) v(tab,perm) loop
  if to_regclass('public.'||row.tab) is not null then
   execute format('drop trigger if exists zz_hayna_admin_audit on public.%I',row.tab);
   execute format('create trigger zz_hayna_admin_audit after insert or update or delete on public.%I for each row execute function app_private.hayna_audit_admin_write(%L)',row.tab,row.perm);
  end if;
 end loop;
end $$;


-- Systems 1, 10, 11. Apply after permission RPC migration; test on an isolated DB first.
-- No production rows are deleted or silently deduplicated. Duplicate review preflight aborts.

alter table public.profiles add column if not exists notification_preferences jsonb not null default '{}'::jsonb;
create or replace function public.hayna_notification_preferences_guard()returns trigger language plpgsql set search_path=''as $$
declare k text;v jsonb;
begin
 if jsonb_typeof(new.notification_preferences)is distinct from 'object'then raise exception 'invalid_preferences'using errcode='22023';end if;
 for k,v in select *from jsonb_each(new.notification_preferences)loop
  if not(k=any(array['emergency','answers','community','stories','follows','reviews','broadcast','alerts','borrow','events']))or jsonb_typeof(v)<>'boolean'then raise exception 'invalid_preferences'using errcode='22023';end if;
 end loop;return new;
end $$;
revoke all on function public.hayna_notification_preferences_guard()from public,anon,authenticated;
drop trigger if exists commerce_notification_preferences_guard on public.profiles;
create trigger commerce_notification_preferences_guard before insert or update of notification_preferences on public.profiles for each row execute function public.hayna_notification_preferences_guard();
create or replace function public.hayna_set_notification_preferences(p_preferences jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; v jsonb; result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if jsonb_typeof(p_preferences)<>'object' or p_preferences is null then raise exception 'invalid_preferences' using errcode='22023'; end if;
 for k,v in select * from jsonb_each(p_preferences) loop
  if not(k=any(array['emergency','answers','community','stories','follows','reviews','broadcast','alerts','borrow','events'])) or jsonb_typeof(v)<>'boolean' then raise exception 'invalid_preferences' using errcode='22023'; end if;
 end loop;
 update public.profiles set notification_preferences=notification_preferences||p_preferences where id=auth.uid() returning notification_preferences into result;
 return result;
end $$;
revoke all on function public.hayna_set_notification_preferences(jsonb) from public,anon;
grant execute on function public.hayna_set_notification_preferences(jsonb) to authenticated;

create or replace function public.hayna_commerce_text_allowed(p_text text) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.banned_words b where b.enabled and length(trim(b.word))>=3
 and position(' '||trim(regexp_replace(translate(lower(b.word),'أإآٱىةؤئ','اااايهوي'),'[^[:alnum:]_]+',' ','g'))||' '
 in ' '||trim(regexp_replace(translate(lower(coalesce(p_text,'')),'أإآٱىةؤئ','اااايهوي'),'[^[:alnum:]_]+',' ','g'))||' ')>0)
$$;
revoke all on function public.hayna_commerce_text_allowed(text) from public,anon,authenticated;

-- 1. Multiple periods share a day; weekly replacement is atomic.
alter table public.business_hours add column if not exists period_index smallint not null default 0;
alter table public.business_hours add column if not exists temporary_closed_until timestamptz;
alter table public.business_hours drop constraint if exists business_hours_business_id_day_of_week_key;
create unique index if not exists business_hours_period_unique on public.business_hours(business_id,day_of_week,period_index);
create or replace function public.hayna_business_hours_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare a integer; z integer; other record; b integer; e integer;
begin
 if new.period_index<0 or new.period_index>5 then raise exception 'maximum_six_periods_per_day' using errcode='22023'; end if;
 if new.temporary_closed_until is not null and(not isfinite(new.temporary_closed_until)or new.temporary_closed_until>now()+interval '90 days')then raise exception 'invalid_temporary_closure'using errcode='22023';end if;
 if extract(second from new.opens_at)<>0 or extract(second from new.closes_at)<>0 then raise exception 'minute_precision_required'using errcode='22023';end if;
 -- Serialize direct writes too, including conflicts spanning the week boundary.
 perform 1 from public.businesses where id=new.business_id for update;
 a:=new.day_of_week*1440+extract(hour from new.opens_at)::integer*60+extract(minute from new.opens_at)::integer;
 z:=new.day_of_week*1440+extract(hour from new.closes_at)::integer*60+extract(minute from new.closes_at)::integer;
 if z<a then z:=z+1440; end if;
 for other in select * from public.business_hours where business_id=new.business_id and id<>new.id loop
  if other.day_of_week=new.day_of_week and (new.is_closed or other.is_closed) then raise exception 'closed_day_has_periods' using errcode='22023'; end if;
  if new.is_closed or other.is_closed then continue; end if;
  b:=other.day_of_week*1440+extract(hour from other.opens_at)::integer*60+extract(minute from other.opens_at)::integer;
  e:=other.day_of_week*1440+extract(hour from other.closes_at)::integer*60+extract(minute from other.closes_at)::integer;
  if e<b then e:=e+1440; end if;
  if (a<e and z>b)or(a<e+10080 and z>b+10080)or(a+10080<e and z+10080>b) then raise exception 'business_hours_overlap' using errcode='22023'; end if;
 end loop;
 return new;
end $$;
drop trigger if exists commerce_hours_guard on public.business_hours;
create trigger commerce_hours_guard before insert or update on public.business_hours for each row execute function public.hayna_business_hours_guard();

create or replace function public.hayna_save_business_hours(p_business_id uuid,p_periods jsonb,p_closed_until timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
declare r jsonb; day_no integer; slot_no integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and not is_banned) then raise exception 'authentication_required' using errcode='42501'; end if;
 if not public.hayna_has_permission('market') and not exists(select 1 from public.businesses b join public.profiles p on p.id=b.owner_id where b.id=p_business_id and p.id=auth.uid() and p.account_type='merchant' and p.is_verified and p.is_verified_merchant and not p.is_banned) then raise exception 'business_owner_required' using errcode='42501'; end if;
 if p_periods is null or jsonb_typeof(p_periods)<>'array' or jsonb_array_length(p_periods)>42 or p_closed_until>now()+interval '90 days' then raise exception 'invalid_business_hours' using errcode='22023'; end if;
 perform 1 from public.businesses where id=p_business_id for update;
 -- Stage replacement in the same transaction so failure preserves the previous week.
 -- Full replacement is intentional schedule editing and is atomic; no unrelated data is touched.
 delete from public.business_hours where business_id=p_business_id;
 for r in select value from jsonb_array_elements(p_periods) loop
  day_no:=(r->>'day_of_week')::integer; slot_no:=coalesce((r->>'period_index')::integer,0);
  insert into public.business_hours(business_id,day_of_week,period_index,opens_at,closes_at,is_closed,temporary_closed_until)
  values(p_business_id,day_no,slot_no,nullif(r->>'opens_at','')::time,nullif(r->>'closes_at','')::time,coalesce((r->>'is_closed')::boolean,false),p_closed_until);
 end loop;
 if jsonb_array_length(p_periods)=0 and p_closed_until is not null then
  insert into public.business_hours(business_id,day_of_week,period_index,is_closed,temporary_closed_until) values(p_business_id,0,0,true,p_closed_until);
 end if;
end $$;

create or replace function public.hayna_business_status(p_business_id uuid,p_at timestamptz default now()) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare local_now timestamp; current_day date; d date; r record; opening timestamptz; closing timestamptz; next_open timestamptz; closed_until timestamptz; is_open boolean:=false;
begin
 if p_at is null or not isfinite(p_at)or p_at<now()-interval '1 year'or p_at>now()+interval '1 year'then raise exception 'invalid_status_time'using errcode='22023';end if;
 if not exists(select 1 from public.businesses where id=p_business_id) then return null; end if;
 select max(temporary_closed_until) into closed_until from public.business_hours where business_id=p_business_id;
 local_now:=p_at at time zone 'Asia/Riyadh'; current_day:=local_now::date;
 for d in select (current_day+i)::date from generate_series(-1,greatest(0,coalesce((closed_until at time zone 'Asia/Riyadh')::date-current_day,0))+8) as i loop
  for r in select * from public.business_hours where business_id=p_business_id and day_of_week=extract(dow from d) and not is_closed loop
   opening:=(d+r.opens_at) at time zone 'Asia/Riyadh';
   closing:=(d+r.closes_at+case when r.closes_at<r.opens_at then interval '1 day' else interval '0 day' end) at time zone 'Asia/Riyadh';
   if p_at>=opening and p_at<closing and (closed_until is null or p_at>=closed_until) then is_open:=true; end if;
   opening:=greatest(opening,coalesce(closed_until,opening));
   if opening>=p_at and opening<closing and (next_open is null or opening<next_open) then next_open:=opening; end if;
  end loop;
 end loop;
 return jsonb_build_object('is_open',is_open,'has_schedule',exists(select 1 from public.business_hours where business_id=p_business_id),'next_opens_at',case when is_open then null else next_open end,'temporary_closed_until',closed_until,'timezone','Asia/Riyadh');
end $$;

-- Restrict all table grants; TRUNCATE is not covered by row policies.
revoke all on public.business_hours,public.reviews,public.events,public.event_attendees from anon,authenticated;
grant select on public.business_hours,public.reviews,public.events to anon,authenticated;
grant select on public.event_attendees to authenticated;
grant insert,update,delete on public.business_hours,public.reviews,public.events to authenticated;
alter table public.business_hours enable row level security;
alter table public.reviews enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
-- Consolidate rather than leaving permissive OR policies that bypass stronger rules.
do $$declare r record;begin for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in('business_hours','reviews','events','event_attendees') loop execute format('drop policy %I on public.%I',r.policyname,r.tablename);end loop;end $$;
create policy commerce_hours_read on public.business_hours for select to anon,authenticated using(exists(select 1 from public.businesses b where b.id=business_id));
create policy commerce_hours_write on public.business_hours for all to authenticated using(public.hayna_has_permission('market')or exists(select 1 from public.businesses b join public.profiles p on p.id=b.owner_id where b.id=business_id and p.id=(select auth.uid()) and p.account_type='merchant' and p.is_verified and p.is_verified_merchant and not p.is_banned)) with check(public.hayna_has_permission('market')or exists(select 1 from public.businesses b join public.profiles p on p.id=b.owner_id where b.id=business_id and p.id=(select auth.uid()) and p.account_type='merchant' and p.is_verified and p.is_verified_merchant and not p.is_banned));

-- 10. One review per target, after mutual contact; never label it a verified purchase.
do $$begin
 if exists(select 1 from public.reviews where business_id is not null group by reviewer_id,business_id having count(*)>1) or exists(select 1 from public.reviews where service_id is not null group by reviewer_id,service_id having count(*)>1) then
  raise exception 'review_duplicates_require_preserving_resolution';
 end if;
end $$;
create unique index if not exists reviews_one_business_per_user on public.reviews(reviewer_id,business_id) where business_id is not null;
create unique index if not exists reviews_one_service_per_user on public.reviews(reviewer_id,service_id) where service_id is not null;
alter table public.reviews add column if not exists updated_at timestamptz not null default now();
alter table public.reviews add column if not exists moderation_status text not null default 'approved';
create or replace function public.hayna_review_eligibility(p_kind text,p_target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_uuid uuid; visible boolean; contacted boolean:=false; actor uuid:=auth.uid();
begin
 if p_kind='business' then select b.owner_id,b.moderation_status='approved' and p.is_verified and p.is_verified_merchant and p.account_type='merchant' and not p.is_banned into owner_uuid,visible from public.businesses b join public.profiles p on p.id=b.owner_id where b.id=p_target;
 elsif p_kind='service' then select s.provider_id,s.moderation_status='approved' and p.is_verified and not p.is_banned and(p.account_type in('freelance','provider')or(p.account_type='merchant'and p.is_verified_merchant)) into owner_uuid,visible from public.services s join public.profiles p on p.id=s.provider_id where s.id=p_target;
 else raise exception 'invalid_review_target' using errcode='22023'; end if;
 if actor is null then return jsonb_build_object('can_review',false,'reason','authentication_required');end if;
 if owner_uuid=actor then return jsonb_build_object('can_review',false,'reason','cannot_review_self');end if;
 if not coalesce(visible,false) or not exists(select 1 from public.profiles where id=actor and not is_banned) then return jsonb_build_object('can_review',false,'reason','target_unavailable');end if;
 select exists(select 1 from public.conversation_members a join public.conversation_members b on b.conversation_id=a.conversation_id
 where a.user_id=actor and b.user_id=owner_uuid and exists(select 1 from public.messages m where m.conversation_id=a.conversation_id and m.sender_id=actor) and exists(select 1 from public.messages m where m.conversation_id=a.conversation_id and m.sender_id=owner_uuid)) into contacted;
 return jsonb_build_object('can_review',contacted,'reason',case when contacted then 'mutual_contact' else 'mutual_contact_required' end);
end $$;
create or replace function public.hayna_review_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare eligibility jsonb;
begin
 if tg_op='UPDATE' and row(new.reviewer_id,new.business_id,new.service_id,new.created_at) is distinct from row(old.reviewer_id,old.business_id,old.service_id,old.created_at) then raise exception 'review_identity_immutable' using errcode='42501';end if;
 if not public.hayna_has_permission('reports') then
  if auth.uid() is distinct from new.reviewer_id then raise exception 'review_owner_required' using errcode='42501';end if;
  eligibility:=public.hayna_review_eligibility(case when new.business_id is null then 'service' else 'business' end,coalesce(new.business_id,new.service_id));
  if not coalesce((eligibility->>'can_review')::boolean,false) then raise exception '%',eligibility->>'reason' using errcode='42501';end if;
  new.moderation_status:=case when tg_op='UPDATE'and old.moderation_status='hidden'then 'hidden'else 'approved'end;
 end if;
 if new.rating not between 1 and 5 or length(coalesce(new.body,''))>1500 then raise exception 'invalid_review' using errcode='22023';end if;
 if not public.hayna_commerce_text_allowed(new.body) then raise exception 'content_not_allowed' using errcode='22023';end if;
 if new.moderation_status not in('approved','hidden')then raise exception 'invalid_review_status' using errcode='22023';end if;
 new.updated_at:=now(); return new;
end $$;
drop trigger if exists commerce_review_guard on public.reviews;
create trigger commerce_review_guard before insert or update on public.reviews for each row execute function public.hayna_review_guard();
create policy commerce_reviews_read on public.reviews for select to anon,authenticated using((moderation_status='approved' and(exists(select 1 from public.businesses b where b.id=business_id)or exists(select 1 from public.services s where s.id=service_id)))or reviewer_id=(select auth.uid())or public.hayna_has_permission('reports'));
create policy commerce_reviews_insert on public.reviews for insert to authenticated with check(reviewer_id=(select auth.uid())and coalesce((public.hayna_review_eligibility(case when business_id is null then 'service' else 'business' end,coalesce(business_id,service_id))->>'can_review')::boolean,false));
create policy commerce_reviews_update on public.reviews for update to authenticated using(reviewer_id=(select auth.uid())or public.hayna_has_permission('reports')) with check(reviewer_id=(select auth.uid())or public.hayna_has_permission('reports'));
create policy commerce_reviews_delete on public.reviews for delete to authenticated using(reviewer_id=(select auth.uid())or public.hayna_has_permission('reports'));
create or replace function public.hayna_review_summary(p_kind text,p_target uuid)returns jsonb language sql stable security invoker set search_path='' as $$select jsonb_build_object('count',count(*),'average',coalesce(round(avg(rating),2),0))from public.reviews where moderation_status='approved'and((p_kind='business'and business_id=p_target)or(p_kind='service'and service_id=p_target))$$;
create or replace function public.hayna_review_notify()returns trigger language plpgsql security definer set search_path='' as $$
declare owner_uuid uuid;
begin
 if new.business_id is not null then select owner_id into owner_uuid from public.businesses where id=new.business_id;else select provider_id into owner_uuid from public.services where id=new.service_id;end if;
 if owner_uuid<>new.reviewer_id and new.moderation_status='approved' and exists(select 1 from public.profiles where id=owner_uuid and not is_banned and coalesce((notification_preferences->>'reviews')::boolean,true))then
  insert into public.notifications(user_id,type,title,body,target_type,target_id,data)values(owner_uuid,'review','تقييم جديد من أحد الجيران','وصل تقييم جديد لتجربة تواصل مع نشاطك.','review',new.id,jsonb_build_object('review_id',new.id,'business_id',new.business_id,'service_id',new.service_id));
 end if;return new;
end $$;
drop trigger if exists commerce_review_notify on public.reviews;
create trigger commerce_review_notify after insert on public.reviews for each row execute function public.hayna_review_notify();

-- 11. Events remain in the existing market flow; participant identities are private.
alter table public.events add column if not exists capacity integer;
alter table public.events add column if not exists show_attendee_count boolean not null default true;
alter table public.events add column if not exists publication_authorized boolean not null default false;
alter table public.event_attendees add column if not exists reminder_enabled boolean not null default true;
alter table public.event_attendees add column if not exists reminded_for timestamptz;
create index if not exists event_attendees_going_idx on public.event_attendees(event_id)where status='going';
drop trigger if exists events_moderation_guard on public.events;
drop trigger if exists zz_event_publication_guard on public.events;
create or replace function public.hayna_event_guard()returns trigger language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype; managing boolean:=public.hayna_has_permission('events');
begin
 if auth.uid() is null then raise exception 'authentication_required'using errcode='42501';end if;
 if tg_op='UPDATE'and row(new.id,new.organizer_id,new.created_at) is distinct from row(old.id,old.organizer_id,old.created_at)then raise exception 'event_identity_immutable'using errcode='42501';end if;
 if tg_op='UPDATE'and auth.uid()=old.organizer_id and new.status='cancelled'and(to_jsonb(new)-'status'-'moderation_status')=(to_jsonb(old)-'status'-'moderation_status')and exists(select 1 from public.profiles where id=auth.uid()and not is_banned)then
  new.moderation_status:=old.moderation_status;return new;
 end if;
 if not managing then
  select * into p from public.profiles where id=auth.uid()and id=new.organizer_id and not is_banned;
  if not found or not p.is_verified or not(p.account_type in('freelance','provider')or(p.account_type='merchant'and p.is_verified_merchant)) then raise exception 'verified_event_organizer_required'using errcode='42501';end if;
  if nullif(trim(p.city),'')is null or nullif(trim(p.district),'')is null or p.city in('كل المدن','كل المملكة','كل مناطق المملكة')or p.district in('كل الأحياء','كل أحياء المدينة','جميع الأحياء')then raise exception 'profile_location_required'using errcode='22023';end if;
  new.city:=p.city;new.district:=p.district;new.moderation_status:='pending';new.publication_authorized:=false;
 else
  new.publication_authorized:=new.moderation_status='approved';
 end if;
 if length(trim(new.title))not between 3 and 100 or length(new.description)>3000 or length(coalesce(new.guidelines,''))>1500 or coalesce(new.category,'community')not in('community','volunteer','sports','family','culture')or length(coalesce(new.location_name,''))not between 3 and 160 or new.ends_at is null or new.ends_at<=new.starts_at or new.ends_at>new.starts_at+interval '14 days' or(new.capacity is not null and new.capacity not between 1 and 10000) then raise exception 'invalid_event_details'using errcode='22023';end if;
 if tg_op='INSERT'and new.starts_at<=now()then raise exception 'event_must_be_future'using errcode='22023';end if;
 if not public.hayna_commerce_text_allowed(concat_ws(' ',new.title,new.description,new.location_name,new.guidelines))then raise exception 'content_not_allowed'using errcode='22023';end if;
 if new.capacity is not null and new.capacity<(select count(*)from public.event_attendees where event_id=new.id and status='going')then raise exception 'capacity_below_attendance'using errcode='23514';end if;
 if tg_op='INSERT'then new.attendees_count:=0;else new.attendees_count:=old.attendees_count;end if;
 -- General venue names only in the community flow; never expose private device coordinates.
 if not managing then new.latitude:=null;new.longitude:=null;end if;
 return new;
end $$;
drop trigger if exists commerce_event_guard on public.events;
create trigger commerce_event_guard before insert or update on public.events for each row execute function public.hayna_event_guard();
create or replace function public.hayna_event_is_public(p_event_id uuid)returns boolean language sql stable security definer set search_path=''as $$select exists(select 1 from public.events e join public.profiles p on p.id=e.organizer_id where e.id=p_event_id and e.moderation_status='approved'and not p.is_banned and(e.publication_authorized or(p.is_verified and(p.account_type in('freelance','provider')or(p.account_type='merchant'and p.is_verified_merchant)))))$$;
revoke all on function public.hayna_event_is_public(uuid)from public;
grant execute on function public.hayna_event_is_public(uuid)to anon,authenticated;
create policy commerce_events_read on public.events for select to anon,authenticated using(organizer_id=(select auth.uid())or public.hayna_has_permission('events')or public.hayna_event_is_public(id));
create policy commerce_events_insert on public.events for insert to authenticated with check(organizer_id=(select auth.uid())or public.hayna_has_permission('events'));
create policy commerce_events_update on public.events for update to authenticated using(organizer_id=(select auth.uid())or public.hayna_has_permission('events'))with check(organizer_id=(select auth.uid())or public.hayna_has_permission('events'));
create policy commerce_events_delete on public.events for delete to authenticated using(organizer_id=(select auth.uid())or public.hayna_has_permission('events'));
create policy commerce_attendees_private on public.event_attendees for select to authenticated using(user_id=(select auth.uid())or public.hayna_has_permission('events')or exists(select 1 from public.events e where e.id=event_id and e.organizer_id=(select auth.uid())));

create or replace function public.hayna_event_attendance(p_event_id uuid,p_going boolean,p_remind boolean default true)returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events%rowtype; total integer; current_status text;
begin
 if auth.uid()is null or not exists(select 1 from public.profiles where id=auth.uid()and not is_banned)then raise exception 'authentication_required'using errcode='42501';end if;
 select * into ev from public.events where id=p_event_id for update;
 if not found then raise exception 'event_unavailable'using errcode='42501';end if;
 if p_going and(not public.hayna_event_is_public(ev.id)or ev.status<>'published'or coalesce(ev.ends_at,ev.starts_at)<=now())then raise exception 'event_unavailable'using errcode='42501';end if;
 select status into current_status from public.event_attendees where event_id=p_event_id and user_id=auth.uid();
 select count(*)::integer into total from public.event_attendees where event_id=p_event_id and status='going';
 if p_going and current_status is distinct from 'going'and ev.capacity is not null and total>=ev.capacity then raise exception 'event_full'using errcode='23514';end if;
 insert into public.event_attendees(event_id,user_id,status,reminder_enabled)values(p_event_id,auth.uid(),case when p_going then 'going'else 'cancelled'end,p_remind)
 on conflict(event_id,user_id)do update set status=excluded.status,reminder_enabled=excluded.reminder_enabled;
 select count(*)::integer into total from public.event_attendees where event_id=p_event_id and status='going';
 return jsonb_build_object('going',p_going,'count',case when ev.show_attendee_count or ev.organizer_id=auth.uid()or public.hayna_has_permission('events')then total else null end);
end $$;

create or replace function public.hayna_event_counts(p_event_ids uuid[])returns table(event_id uuid,attendee_count bigint)
language sql stable security definer set search_path='' as $$
 select e.id,case when e.show_attendee_count or e.organizer_id=auth.uid()or public.hayna_has_permission('events')then(select count(*)from public.event_attendees a where a.event_id=e.id and a.status='going')else null end
 from public.events e where e.id=any(p_event_ids)and cardinality(p_event_ids)<=100 and(e.organizer_id=auth.uid()or public.hayna_has_permission('events')or public.hayna_event_is_public(e.id))
$$;
create or replace function app_private.hayna_dispatch_event_reminders()returns integer language plpgsql security definer set search_path='' as $$
declare a record; sent integer:=0;
begin
 for a in select r.event_id,r.user_id,e.title,e.starts_at from public.event_attendees r join public.events e on e.id=r.event_id join public.profiles p on p.id=r.user_id
 where r.status='going'and r.reminder_enabled and r.reminded_for is distinct from e.starts_at and e.status='published'and public.hayna_event_is_public(e.id)and e.starts_at>now()and e.starts_at<=now()+interval '24 hours'and not p.is_banned and coalesce((p.notification_preferences->>'events')::boolean,true)and coalesce((p.notification_preferences->>'community')::boolean,true)
 order by e.starts_at,r.event_id,r.user_id limit 500 for update of r skip locked loop
  insert into public.notifications(user_id,type,title,body,target_type,target_id,data)values(a.user_id,'event_reminder','تذكير بفعالية الحي',a.title,'event',a.event_id,jsonb_build_object('event_id',a.event_id,'starts_at',a.starts_at));
  update public.event_attendees set reminded_for=a.starts_at where event_id=a.event_id and user_id=a.user_id;sent:=sent+1;
 end loop;return sent;
end $$;
revoke all on function app_private.hayna_dispatch_event_reminders()from public,anon,authenticated;
create or replace function public.hayna_dispatch_event_reminders()returns integer language plpgsql security definer set search_path=''as $$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role'and not public.hayna_has_permission('events')then raise exception 'permission_required'using errcode='42501';end if;
 return app_private.hayna_dispatch_event_reminders();
end $$;
-- Scheduled execution is wired by the shared backend scheduler after staging verification.
create or replace function public.hayna_report_commerce(p_kind text,p_target uuid,p_reason text)returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid()is null or not exists(select 1 from public.profiles where id=auth.uid()and not is_banned)then raise exception 'authentication_required'using errcode='42501';end if;
 if p_kind not in('review','event')or length(trim(p_reason))not between 5 and 1000 then raise exception 'invalid_report'using errcode='22023';end if;
 if(p_kind='review'and not exists(select 1 from public.reviews where id=p_target and moderation_status='approved'))or(p_kind='event'and not exists(select 1 from public.events where id=p_target and moderation_status='approved'))then raise exception 'target_unavailable'using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_kind||p_target::text,0));
 select id into result from public.reports where reporter_id=auth.uid()and target_type=p_kind and target_id=p_target and status='pending'limit 1;
 if result is not null then return result;end if;
 insert into public.reports(reporter_id,target_type,target_id,reason)values(auth.uid(),p_kind,p_target,trim(p_reason))returning id into result;return result;
end $$;

-- Explicit RPC/trigger grants, no PUBLIC execute defaults.
revoke all on function public.hayna_business_hours_guard(),public.hayna_review_guard(),public.hayna_review_notify(),public.hayna_event_guard()from public,anon,authenticated;
revoke all on function public.hayna_save_business_hours(uuid,jsonb,timestamptz),public.hayna_event_attendance(uuid,boolean,boolean),public.hayna_dispatch_event_reminders(),public.hayna_report_commerce(text,uuid,text)from public,anon;
grant execute on function public.hayna_save_business_hours(uuid,jsonb,timestamptz),public.hayna_event_attendance(uuid,boolean,boolean),public.hayna_report_commerce(text,uuid,text)to authenticated;
grant execute on function public.hayna_dispatch_event_reminders()to authenticated,service_role;
revoke all on function public.hayna_business_status(uuid,timestamptz),public.hayna_review_eligibility(text,uuid),public.hayna_review_summary(text,uuid),public.hayna_event_counts(uuid[])from public;
grant execute on function public.hayna_business_status(uuid,timestamptz),public.hayna_review_eligibility(text,uuid),public.hayna_review_summary(text,uuid),public.hayna_event_counts(uuid[])to anon,authenticated;
create or replace function public.hayna_business_summaries(p_business_ids uuid[])returns table(business_id uuid,review_count bigint,rating numeric,status jsonb)language sql stable security invoker set search_path=''as $$
 select b.id,(select count(*)from public.reviews r where r.business_id=b.id and r.moderation_status='approved'),(select round(avg(r.rating),2)from public.reviews r where r.business_id=b.id and r.moderation_status='approved'),public.hayna_business_status(b.id)
 from public.businesses b where b.id=any(p_business_ids)and cardinality(p_business_ids)<=100
$$;
revoke all on function public.hayna_business_summaries(uuid[])from public;
grant execute on function public.hayna_business_summaries(uuid[])to anon,authenticated;

create or replace function public.hayna_commerce_sensitive_audit()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if(tg_table_name='reviews'and new.moderation_status is distinct from old.moderation_status)or(tg_table_name='events'and(row(to_jsonb(new)->'moderation_status',to_jsonb(new)->'status')is distinct from row(to_jsonb(old)->'moderation_status',to_jsonb(old)->'status')))then
  insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata)values(auth.uid(),'commerce_moderation',case when tg_table_name='reviews'then 'review'else 'event'end,new.id,jsonb_build_object('before',jsonb_build_object('moderation_status',old.moderation_status,'status',to_jsonb(old)->'status'),'after',jsonb_build_object('moderation_status',new.moderation_status,'status',to_jsonb(new)->'status')));
 end if;return new;
end $$;
revoke all on function public.hayna_commerce_sensitive_audit()from public,anon,authenticated;
drop trigger if exists commerce_sensitive_audit on public.reviews;
create trigger commerce_sensitive_audit after update on public.reviews for each row execute function public.hayna_commerce_sensitive_audit();
drop trigger if exists commerce_sensitive_audit on public.events;
create trigger commerce_sensitive_audit after update on public.events for each row execute function public.hayna_commerce_sensitive_audit();

-- Existing community tables are extended without removing user data.
-- Dependency: public.hayna_has_permission(text), profiles.notification_preferences.
revoke truncate, references, trigger on public.request_tags,public.borrow_items,public.borrow_requests,public.scheduled_broadcasts,public.urgent_alerts from anon,authenticated;

create or replace function app_private.community_normalize(value text)
returns text language sql immutable set search_path=pg_catalog as $$
 select trim(regexp_replace(translate(regexp_replace(lower(coalesce(value,'')),U&'[\064B-\065F\0670\0640\200B-\200F\202A-\202E\2060\2066-\2069\FEFF]','','g'),'أإآٱىةؤئ','اااايهوي'),'[[:space:]#]+',' ','g'));
$$;
create or replace function app_private.community_text_allowed(value text)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare word_row record; letters text; pattern text; normalized text:=app_private.community_normalize(value);
begin
 for word_row in select word from public.banned_words where enabled loop
  letters:=regexp_replace(app_private.community_normalize(word_row.word),'[^[:alnum:]]','','g');
  if length(letters)<2 then continue; end if;
  select '(^|[^[:alnum:]])'||string_agg(substr(letters,n,1),'[^[:alnum:]]*')||'([^[:alnum:]]|$)' into pattern from generate_series(1,length(letters)) n;
  if normalized ~ pattern then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function app_private.community_normalize(text),app_private.community_text_allowed(text) from public,anon,authenticated;

create or replace function app_private.guard_request_tag()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is not null and not exists(select 1 from public.profiles where id=auth.uid() and not is_banned) then raise exception 'الحساب غير مخول بتعديل الوسوم.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('request-tags:'||new.request_id,0));
 new.tag:=app_private.community_normalize(new.tag);
 if length(new.tag) not between 2 and 30 or new.tag !~ '^[[:alnum:] _-]+$' or not app_private.community_text_allowed(new.tag) then
  raise exception 'وسم غير مناسب أو غير صالح.' using errcode='22023';
 end if;
 if (select count(*) from public.request_tags where request_id=new.request_id)>=5 and not exists(select 1 from public.request_tags where request_id=new.request_id and tag=new.tag) then
  raise exception 'يمكن إضافة خمسة وسوم فقط.' using errcode='22023';
 end if;
 return new;
end $$;
drop trigger if exists hayna_request_tag_guard on public.request_tags;
create trigger hayna_request_tag_guard before insert or update on public.request_tags for each row execute function app_private.guard_request_tag();
revoke all on function app_private.guard_request_tag() from public,anon,authenticated;
drop policy if exists "request tags readable" on public.request_tags;
create policy "request tags readable" on public.request_tags for select to anon,authenticated using(exists(select 1 from public.requests r where r.id=request_id));

create or replace function public.hayna_set_request_tags(p_request_id uuid,p_tags text[])
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not exists(select 1 from public.requests r join public.profiles p on p.id=r.requester_id where r.id=p_request_id and r.requester_id=auth.uid() and not p.is_banned) then
  raise exception 'لا تملك صلاحية تعديل الوسوم.' using errcode='42501';
 end if;
 if coalesce(cardinality(p_tags),0)>5 then raise exception 'الحد الأقصى خمسة وسوم.' using errcode='22023'; end if;
 perform 1 from public.requests where id=p_request_id for update;
 delete from public.request_tags where request_id=p_request_id;
 insert into public.request_tags(request_id,tag) select p_request_id,app_private.community_normalize(t) from unnest(coalesce(p_tags,'{}'::text[])) t on conflict do nothing;
end $$;
create or replace function public.hayna_create_tagged_request(p_title text,p_description text,p_city text,p_district text,p_budget numeric default null,p_tags text[] default '{}')
returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare created_id uuid;
begin
 if auth.uid() is null then raise exception 'سجّل الدخول أولًا.' using errcode='42501'; end if;
 if length(trim(p_title)) not between 5 and 120 or length(trim(p_description)) not between 1 and 5000 or length(trim(p_city))<2 or (p_budget is not null and (p_budget<0 or p_budget>100000)) then
  raise exception 'راجع عنوان الفزعة والموقع والمكافأة.' using errcode='22023'; end if;
 insert into public.requests(requester_id,title,description,city,district,budget,request_type,status)
 values(auth.uid(),trim(p_title),trim(p_description),trim(p_city),nullif(trim(p_district),''),p_budget,'help','open') returning id into created_id;
 if created_id is null then raise exception 'تعذر نشر الطلب حسب سياسة المحتوى.' using errcode='22023'; end if;
 perform public.hayna_set_request_tags(created_id,p_tags);
 return created_id;
end $$;
create or replace function public.hayna_request_tags(p_request_ids uuid[])
returns table(request_id uuid,tag text) language sql stable security invoker set search_path=pg_catalog as $$
 select t.request_id,t.tag from public.request_tags t where t.request_id=any(p_request_ids[1:100]);
$$;
revoke all on function public.hayna_set_request_tags(uuid,text[]),public.hayna_create_tagged_request(text,text,text,text,numeric,text[]),public.hayna_request_tags(uuid[]) from public,anon;
grant execute on function public.hayna_set_request_tags(uuid,text[]),public.hayna_create_tagged_request(text,text,text,text,numeric,text[]),public.hayna_request_tags(uuid[]) to authenticated;
grant execute on function public.hayna_request_tags(uuid[]) to anon;

alter table public.borrow_items add column if not exists image_urls text[] not null default '{}',add column if not exists condition_note text;
alter table public.borrow_requests add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
 add column if not exists owner_pickup_at timestamptz,add column if not exists borrower_pickup_at timestamptz,
 add column if not exists returned_at timestamptz,add column if not exists completed_at timestamptz;
create index if not exists borrow_items_area_status_created_idx on public.borrow_items(city,district,status,created_at desc);
create index if not exists borrow_requests_active_item_idx on public.borrow_requests(item_id,status);
-- Existing duplicate requests, if any, are preserved. Row locks enforce uniqueness for all new operations.
create or replace function app_private.guard_borrow_item()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare p public.profiles%rowtype;
begin
 if current_user in ('postgres','service_role') then return new; end if;
 select * into p from public.profiles where id=auth.uid() and not is_banned;
 if not found or new.owner_id<>auth.uid() then raise exception 'لا تملك صلاحية هذا الغرض.' using errcode='42501'; end if;
 if tg_op='UPDATE' and new.status is distinct from old.status and not ((new.status='cancelled' and old.status='available') or (new.status='available' and old.status='cancelled')) then
  raise exception 'تُدار حالة الإعارة عبر الطلب فقط.' using errcode='42501'; end if;
 if tg_op='INSERT' then new.status:='available'; end if;
 if new.status='cancelled' and exists(select 1 from public.borrow_requests where item_id=new.id and status in ('accepted','borrowed','return_requested','disputed')) then raise exception 'أكمل الإعارة الحالية أولًا.'; end if;
 if length(trim(coalesce(p.city,'')))<2 or length(trim(coalesce(p.district,'')))<2 or p.city in ('كل المملكة','كل المدن') or p.district in ('كل الأحياء','كل أحياء المدينة') then raise exception 'حدد مدينتك وحيّك في الملف الشخصي أولًا.' using errcode='22023'; end if;
 new.city:=p.city;new.district:=p.district;new.updated_at:=now();
 if length(trim(new.title)) not between 3 and 120 or new.max_days not between 1 and 30 or cardinality(new.image_urls)>4 or not app_private.community_text_allowed(concat_ws(' ',new.title,new.description,new.condition_note,new.deposit_note)) then raise exception 'راجع بيانات الغرض والمدة؛ الحد الأقصى ٣٠ يومًا.' using errcode='22023'; end if;
 return new;
end $$;
-- This trigger is invoker so direct client writes cannot impersonate a privileged transition.
grant execute on function app_private.community_text_allowed(text) to authenticated;
grant usage on schema app_private to authenticated;
drop trigger if exists hayna_borrow_item_guard on public.borrow_items;
create trigger hayna_borrow_item_guard before insert or update on public.borrow_items for each row execute function app_private.guard_borrow_item();
revoke all on function app_private.guard_borrow_item() from public,anon,authenticated;
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename in ('borrow_items','borrow_requests') loop
  execute format('drop policy %I on public.%I',p.policyname,(select tablename from pg_policies where schemaname='public' and policyname=p.policyname and tablename in ('borrow_items','borrow_requests') limit 1));
 end loop;
end $$;
create policy borrow_items_read on public.borrow_items for select to anon,authenticated using(status='available' or owner_id=(select auth.uid()) or public.hayna_has_permission('content'));
create policy borrow_items_insert on public.borrow_items for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and not is_banned));
create policy borrow_items_update on public.borrow_items for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy borrow_requests_read on public.borrow_requests for select to authenticated using(borrower_id=(select auth.uid()) or exists(select 1 from public.borrow_items i where i.id=item_id and i.owner_id=(select auth.uid())) or public.hayna_has_permission('reports'));
revoke insert,update,delete on public.borrow_requests from anon,authenticated;

create or replace function app_private.community_notify(p_user uuid,p_type text,p_title text,p_body text,p_target uuid,p_data jsonb default '{}')
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into public.notifications(user_id,type,title,body,target_type,target_id,data)
 select p_user,p_type,p_title,p_body,case when p_type='borrow' then 'borrow_item' else p_type end,p_target,p_data
 from public.profiles where id=p_user and not is_banned and coalesce((notification_preferences->>p_type)::boolean,true);
end $$;
revoke all on function app_private.community_notify(uuid,text,text,text,uuid,jsonb) from public,anon,authenticated;
create or replace function public.hayna_request_borrow(p_item_id uuid,p_days integer,p_note text default '',p_start_date date default ((now() at time zone 'Asia/Riyadh')::date))
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare item public.borrow_items%rowtype; request_id uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and not is_banned) then raise exception 'سجّل الدخول بحساب نشط.' using errcode='42501'; end if;
 select * into item from public.borrow_items where id=p_item_id for update;
 if not found or item.owner_id=auth.uid() or item.status<>'available' then raise exception 'الغرض غير متاح أو مملوك لك.' using errcode='22023'; end if;
 if p_days is null or p_days not between 1 and item.max_days or p_start_date is null or p_start_date<(now() at time zone 'Asia/Riyadh')::date or p_start_date>(now() at time zone 'Asia/Riyadh')::date+30 or length(coalesce(p_note,''))>1000 or not app_private.community_text_allowed(p_note) then raise exception 'راجع المدة والموعد ونص الطلب.' using errcode='22023'; end if;
 if exists(select 1 from public.borrow_requests where item_id=p_item_id and borrower_id=auth.uid() and status in ('pending','accepted','borrowed','return_requested','disputed')) then raise exception 'لديك طلب نشط لهذا الغرض بالفعل.' using errcode='23505'; end if;
 insert into public.borrow_requests(item_id,borrower_id,duration_days,start_date,note) values(p_item_id,auth.uid(),p_days,p_start_date,nullif(trim(p_note),'')) returning id into request_id;
 perform app_private.community_notify(item.owner_id,'borrow','طلب استعارة جديد','طلب أحد الجيران استعارة «'||item.title||'».',item.id,jsonb_build_object('url','/tools?tab=requests','borrow_request_id',request_id));
 return request_id;
end $$;
create or replace function public.hayna_transition_borrow(p_request_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare req public.borrow_requests%rowtype; item public.borrow_items%rowtype; item_id uuid; other_user uuid; conv uuid; next_status text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and not is_banned) then raise exception 'سجّل الدخول بحساب نشط.' using errcode='42501'; end if;
 select r.item_id into item_id from public.borrow_requests r where id=p_request_id;
 select * into item from public.borrow_items where id=item_id for update;
 select * into req from public.borrow_requests where id=p_request_id for update;
 if req.id is null or auth.uid() not in (req.borrower_id,item.owner_id) then raise exception 'لا تملك صلاحية هذا الطلب.' using errcode='42501'; end if;
 other_user:=case when auth.uid()=item.owner_id then req.borrower_id else item.owner_id end;
 next_status:=req.status;
 if p_action='accept' and auth.uid()=item.owner_id and req.status='pending' then
  if item.status<>'available' or exists(select 1 from public.borrow_requests where public.borrow_requests.item_id=item.id and id<>req.id and status in ('accepted','borrowed','return_requested','disputed')) then raise exception 'حُجز الغرض لطلب آخر.' using errcode='23505'; end if;
  if req.start_date+req.duration_days<(now() at time zone 'Asia/Riyadh')::date then raise exception 'انتهت مدة الطلب. اطلب من الجار إرسال طلب جديد.'; end if;
  if public.hayna_can_dm(item.owner_id,req.borrower_id) then conv:=public.hayna_get_or_create_direct_conversation(req.borrower_id); end if;
  update public.borrow_requests set conversation_id=conv where id=req.id;
  update public.borrow_items set status='reserved',updated_at=now() where id=item.id;
  next_status:='accepted';
 elsif p_action='reject' and auth.uid()=item.owner_id and req.status='pending' then next_status:='rejected';
 elsif p_action='cancel' and req.status in ('pending','accepted') then
  next_status:='cancelled';if req.status='accepted' then update public.borrow_items set status='available',updated_at=now() where id=item.id; end if;
 elsif p_action='pickup' and req.status='accepted' then
  if auth.uid()=item.owner_id then update public.borrow_requests set owner_pickup_at=coalesce(owner_pickup_at,now()) where id=req.id;
  else update public.borrow_requests set borrower_pickup_at=coalesce(borrower_pickup_at,now()) where id=req.id; end if;
  if exists(select 1 from public.borrow_requests where id=req.id and owner_pickup_at is not null and borrower_pickup_at is not null) then next_status:='borrowed';update public.borrow_items set status='loaned',updated_at=now() where id=item.id; end if;
 elsif p_action='return' and auth.uid()=req.borrower_id and req.status='borrowed' then next_status:='return_requested';update public.borrow_requests set returned_at=now() where id=req.id;
 elsif p_action='confirm_return' and auth.uid()=item.owner_id and req.status='return_requested' then next_status:='returned';update public.borrow_requests set completed_at=now() where id=req.id;update public.borrow_items set status='available',updated_at=now() where id=item.id;
 elsif p_action='dispute' and req.status in ('accepted','borrowed','return_requested') then
  next_status:='disputed';
  insert into public.reports(reporter_id,target_type,target_id,reason) values(auth.uid(),'borrow_item',item.id,'نزاع إعارة — طلب '||req.id);
 else raise exception 'هذا الإجراء غير مسموح في الحالة الحالية.' using errcode='42501'; end if;
 if p_action='pickup' and ((auth.uid()=item.owner_id and req.owner_pickup_at is not null) or (auth.uid()=req.borrower_id and req.borrower_pickup_at is not null)) then
  return jsonb_build_object('status',next_status,'conversation_id',coalesce(conv,req.conversation_id),'already_confirmed',true);
 end if;
 update public.borrow_requests set status=next_status,updated_at=now() where id=req.id;
 perform app_private.community_notify(other_user,'borrow','تحديث طلب الإعارة','تغيرت حالة إعارة «'||item.title||'».',item.id,jsonb_build_object('url','/tools?tab=requests','borrow_request_id',req.id,'status',next_status));
 return jsonb_build_object('status',next_status,'conversation_id',coalesce(conv,req.conversation_id));
end $$;
revoke all on function public.hayna_request_borrow(uuid,integer,text,date),public.hayna_transition_borrow(uuid,text) from public,anon;
grant execute on function public.hayna_request_borrow(uuid,integer,text,date),public.hayna_transition_borrow(uuid,text) to authenticated;

create or replace function public.hayna_my_borrow_requests()
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) from (
  select r.created_at,to_jsonb(r)||jsonb_build_object('item',jsonb_build_object('id',i.id,'title',i.title,'owner_id',i.owner_id,'city',i.city,'district',i.district,'image_url',i.image_url),
   'borrower_name',b.display_name,'owner_name',o.display_name) row_data
  from public.borrow_requests r join public.borrow_items i on i.id=r.item_id join public.profiles b on b.id=r.borrower_id join public.profiles o on o.id=i.owner_id
  where auth.uid() in (r.borrower_id,i.owner_id) order by r.created_at desc limit 100
 ) visible;
$$;
revoke all on function public.hayna_my_borrow_requests() from public,anon;
grant execute on function public.hayna_my_borrow_requests() to authenticated;

alter table public.urgent_alerts add column if not exists severity text not null default 'important',add column if not exists expires_at timestamptz,
 add column if not exists source_label text not null default 'تنبيه مجتمعي';
create index if not exists urgent_alerts_area_expiry_idx on public.urgent_alerts(city,district,expires_at) where status='active';
create or replace function app_private.guard_urgent_alert()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is not null and not public.hayna_has_permission('alerts') then
  if tg_op='UPDATE' and old.creator_id=auth.uid() and new.status='resolved' and row(new.title,new.description,new.city,new.district,new.severity,new.expires_at) is not distinct from row(old.title,old.description,old.city,old.district,old.severity,old.expires_at) then return new; end if;
  raise exception 'نشر التنبيهات العامة متاح للمخولين فقط.' using errcode='42501';
 end if;
 if length(trim(new.title)) not between 5 and 140 or length(trim(new.description)) not between 5 and 3000 or new.severity not in ('notice','important','urgent') or new.status not in ('active','resolved','cancelled') or length(trim(new.city))<2 or new.expires_at is null or new.expires_at<=now() or new.expires_at>now()+interval '7 days' or not app_private.community_text_allowed(new.title||' '||new.description) then raise exception 'راجع التنبيه ووقت انتهائه، بحد أقصى سبعة أيام.' using errcode='22023'; end if;
 if tg_op='INSERT' and auth.uid() is not null then
  perform pg_advisory_xact_lock(hashtextextended('alerts:'||auth.uid(),0));
  if (select count(*) from public.urgent_alerts where creator_id=auth.uid() and created_at>now()-interval '1 hour')>=3 then raise exception 'وصلت إلى الحد المسموح للتنبيهات في الساعة.' using errcode='42900'; end if;
  new.creator_id:=auth.uid();
 end if;
 new.location_lat:=null;new.location_lng:=null;new.source_label:='تنبيه مجتمعي';
 if new.status<>'active' then new.resolved_at:=now(); end if;
 return new;
end $$;
drop trigger if exists hayna_urgent_guard on public.urgent_alerts;
create trigger hayna_urgent_guard before insert or update on public.urgent_alerts for each row execute function app_private.guard_urgent_alert();
revoke all on function app_private.guard_urgent_alert() from public,anon,authenticated;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='urgent_alerts' loop execute format('drop policy %I on public.urgent_alerts',p.policyname);end loop;end $$;
create policy urgent_alerts_read on public.urgent_alerts for select to anon,authenticated using((status='active' and expires_at>now() and location_lat is null and location_lng is null) or creator_id=(select auth.uid()) or public.hayna_has_permission('alerts'));
create policy urgent_alerts_insert on public.urgent_alerts for insert to authenticated with check(creator_id=(select auth.uid()) and public.hayna_has_permission('alerts'));
create policy urgent_alerts_update on public.urgent_alerts for update to authenticated using(public.hayna_has_permission('alerts') or creator_id=(select auth.uid())) with check(public.hayna_has_permission('alerts') or creator_id=(select auth.uid()));
create policy urgent_alerts_delete on public.urgent_alerts for delete to authenticated using(public.hayna_has_permission('alerts') or creator_id=(select auth.uid()));
create or replace function app_private.notify_urgent_alert()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into public.notifications(user_id,type,title,body,target_type,target_id,data)
 select p.id,'alerts',new.title,new.description,'urgent_alert',new.id,jsonb_build_object('url','/emergency-alert','expires_at',new.expires_at)
 from public.profiles p where not p.is_banned and p.city=new.city and (coalesce(new.district,'')='' or new.district='كل الأحياء' or p.district=new.district)
 and coalesce((p.notification_preferences->>'alerts')::boolean,true) and coalesce((p.notification_preferences->>'emergency')::boolean,true);
 insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata) values(new.creator_id,'publish_alert','urgent_alert',new.id,jsonb_build_object('city',new.city,'district',new.district,'severity',new.severity));
 return new;
end $$;
drop trigger if exists hayna_urgent_notify on public.urgent_alerts;
create trigger hayna_urgent_notify after insert on public.urgent_alerts for each row execute function app_private.notify_urgent_alert();
revoke all on function app_private.notify_urgent_alert() from public,anon,authenticated;

alter table public.scheduled_broadcasts add column if not exists image_url text,add column if not exists link_url text,add column if not exists expires_at timestamptz,
 add column if not exists attempts integer not null default 0,add column if not exists last_error text,add column if not exists last_attempt_at timestamptz,
 add column if not exists recipient_count integer not null default 0,add column if not exists request_key uuid;
create unique index if not exists scheduled_broadcasts_request_key_idx on public.scheduled_broadcasts(created_by,request_key) where request_key is not null;
create or replace function app_private.guard_scheduled_broadcast()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if current_user in ('postgres','service_role') then return new; end if;
 if not public.hayna_has_permission('broadcast') then raise exception 'لا تملك صلاحية إدارة البث.' using errcode='42501'; end if;
 if tg_op='INSERT' then new.created_by:=auth.uid();new.attempts:=0;new.recipient_count:=0;new.sent_at:=null;
 elsif old.status in ('sent','expired') then raise exception 'لا يمكن تعديل رسالة منشورة أو منتهية.' using errcode='42501';
 elsif row(new.created_by,new.attempts,new.last_error,new.last_attempt_at,new.recipient_count,new.sent_at) is distinct from row(old.created_by,old.attempts,old.last_error,old.last_attempt_at,old.recipient_count,old.sent_at) then raise exception 'حقول التنفيذ محمية.' using errcode='42501'; end if;
 if new.status not in ('draft','pending','canceled') or length(trim(new.title)) not between 1 and 180 or length(trim(new.body)) not between 1 and 4000 or new.broadcast_type not in ('official','emergency','weather','maintenance') or coalesce(new.target->>'segment','all') not in ('all','verified','unverified','admins') or new.scheduled_at is null or (new.expires_at is not null and new.expires_at<=new.scheduled_at) or (new.link_url is not null and new.link_url !~ '^(https://[^[:space:]]+|/[a-zA-Z][^[:space:]]*)$') or (new.image_url is not null and new.image_url !~ '^https://[^[:space:]]+$') then raise exception 'راجع بيانات الإعلان والرابط ووقت الانتهاء.' using errcode='22023'; end if;
 return new;
end $$;
drop trigger if exists hayna_scheduled_guard on public.scheduled_broadcasts;
create trigger hayna_scheduled_guard before insert or update on public.scheduled_broadcasts for each row execute function app_private.guard_scheduled_broadcast();
revoke all on function app_private.guard_scheduled_broadcast() from public,anon,authenticated;
do $$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='scheduled_broadcasts' loop execute format('drop policy %I on public.scheduled_broadcasts',p.policyname);end loop;end $$;
create policy broadcasts_read on public.scheduled_broadcasts for select to authenticated using(public.hayna_has_permission('broadcast'));
create policy broadcasts_insert on public.scheduled_broadcasts for insert to authenticated with check(public.hayna_has_permission('broadcast') and created_by=(select auth.uid()));
create policy broadcasts_update on public.scheduled_broadcasts for update to authenticated using(public.hayna_has_permission('broadcast')) with check(public.hayna_has_permission('broadcast'));
create policy broadcasts_delete on public.scheduled_broadcasts for delete to authenticated using(public.hayna_has_permission('broadcast') and status in ('draft','canceled'));

create or replace function app_private.dispatch_community_broadcast(p_id uuid,p_force boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare b public.scheduled_broadcasts%rowtype; recipients integer:=0;
begin
 select * into b from public.scheduled_broadcasts where id=p_id for update;
 if not found then raise exception 'الإعلان غير موجود.' using errcode='P0002'; end if;
 if b.status='sent' then return jsonb_build_object('already_sent',true,'recipients',b.recipient_count,'pushed',0); end if;
 if b.status<>'pending' then raise exception 'الرسالة غير مجدولة.' using errcode='22023'; end if;
 if b.expires_at is not null and b.expires_at<=now() then update public.scheduled_broadcasts set status='expired' where id=b.id;return jsonb_build_object('expired',true,'recipients',0);end if;
 if not p_force and b.scheduled_at>now() then return jsonb_build_object('not_due',true,'recipients',0); end if;
 if not app_private.hayna_user_has_permission(b.created_by,'broadcast') then
  update public.scheduled_broadcasts set status='failed',last_error='فقد منشئ الرسالة صلاحية الإدارة.' where id=b.id;
  return jsonb_build_object('failed',true,'recipients',0);
 end if;
 update public.scheduled_broadcasts set attempts=attempts+1,last_attempt_at=now(),last_error=null where id=b.id;
 begin
  insert into public.notifications(user_id,type,title,body,data)
  select p.id,'broadcast',b.title,b.body,jsonb_strip_nulls(jsonb_build_object('broadcast_id',b.id,'broadcast_type',b.broadcast_type,'image_url',b.image_url,'url',b.link_url,'expires_at',b.expires_at))
  from public.profiles p where not p.is_banned and coalesce((p.notification_preferences->>'broadcast')::boolean,true)
  and(coalesce(b.target->>'scope','all')='all' or p.city=b.target->>'scope')
  and(coalesce(b.target->>'district','')='' or b.target->>'district'='كل الأحياء' or p.district=b.target->>'district')
  and(case coalesce(b.target->>'segment','all') when 'all' then true when 'verified' then p.is_verified when 'unverified' then not p.is_verified when 'admins' then p.role='admin' else false end);
  get diagnostics recipients=row_count;
  update public.scheduled_broadcasts set status='sent',sent_at=now(),recipient_count=recipients where id=b.id;
  insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata) values(b.created_by,'dispatch_broadcast','broadcast',b.id,jsonb_build_object('recipients',recipients));
 exception when others then
  update public.scheduled_broadcasts set last_error='تعذر التنفيذ. راجع سجل الخادم.' where id=b.id;
  return jsonb_build_object('failed',true,'recipients',0);
 end;
 return jsonb_build_object('recipients',recipients,'pushed',0,'push_queued',true);
end $$;
revoke all on function app_private.dispatch_community_broadcast(uuid,boolean) from public,anon,authenticated;
create or replace function public.admin_dispatch_scheduled_broadcast(p_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.hayna_has_permission('broadcast') then raise exception 'لا تملك صلاحية إرسال الإعلانات.' using errcode='42501';end if;
 return app_private.dispatch_community_broadcast(p_id,true);
end $$;
create or replace function public.admin_send_broadcast(p_title text,p_body text,p_type text,p_scope text,p_segment text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare b uuid;
begin
 if not public.hayna_has_permission('broadcast') then raise exception 'لا تملك صلاحية إرسال الإعلانات.' using errcode='42501';end if;
 if length(trim(p_title)) not between 1 and 180 or length(trim(p_body)) not between 1 and 4000 or p_type not in ('official','emergency','weather','maintenance') or p_segment not in ('all','verified','unverified','admins') then raise exception 'راجع بيانات الإعلان.' using errcode='22023';end if;
 insert into public.scheduled_broadcasts(title,body,broadcast_type,target,scheduled_at,created_by) values(trim(p_title),trim(p_body),p_type,jsonb_build_object('scope',p_scope,'segment',p_segment),now(),auth.uid()) returning id into b;
 return app_private.dispatch_community_broadcast(b,true);
end $$;
revoke all on function public.admin_dispatch_scheduled_broadcast(uuid),public.admin_send_broadcast(text,text,text,text,text) from public,anon;
grant execute on function public.admin_dispatch_scheduled_broadcast(uuid),public.admin_send_broadcast(text,text,text,text,text) to authenticated;
create or replace function app_private.dispatch_due_community_broadcasts()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare b record; result jsonb; recipients integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('backend-job:scheduled-broadcast-dispatch',0));
 for b in select id from public.scheduled_broadcasts where status='pending' and scheduled_at<=now() and attempts<5 and(last_attempt_at is null or last_attempt_at<now()-interval '5 minutes') order by scheduled_at,id limit 20 for update skip locked loop
  result:=app_private.dispatch_community_broadcast(b.id,false);recipients:=recipients+coalesce((result->>'recipients')::integer,0);
 end loop;
 update public.scheduled_broadcasts set status='expired' where status in ('pending','sent') and expires_at<=now();
 return jsonb_build_object('recipients',recipients);
end $$;
revoke all on function app_private.dispatch_due_community_broadcasts() from public,anon,authenticated;
-- Keep existing maintenance tasks and their original implementations intact.
do $$ begin
 if to_regprocedure('app_private.run_backend_job(text)') is not null and to_regprocedure('app_private.run_backend_job_before_community(text)') is null then
  alter function app_private.run_backend_job(text) rename to run_backend_job_before_community;
 end if;
end $$;
create or replace function app_private.run_backend_job(p_task text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_task='scheduled-broadcast-dispatch' then
  if to_regprocedure('app_private.hayna_dispatch_event_reminders()') is not null then perform app_private.hayna_dispatch_event_reminders();end if;
  return app_private.dispatch_due_community_broadcasts();
 end if;
 return app_private.run_backend_job_before_community(p_task);
end $$;
revoke all on function app_private.run_backend_job(text) from public,anon,authenticated,service_role;
-- Retain the existing Vercel dispatcher. Prevent duplicate Expo sends without copying any secret.
drop trigger if exists notifications_push_after_insert on public.notifications;
-- Reuse the existing publication. Private request visibility is still governed by RLS.
do $$ declare table_name text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach table_name in array array['borrow_items','borrow_requests','urgent_alerts'] loop
   if not exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=table_name) then
    execute format('alter publication supabase_realtime add table public.%I',table_name);
   end if;
  end loop;
 end if;
end $$;


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


-- Extra RBAC boundaries. Apply after the core RBAC migration and existing feature migrations.
-- No assignment or global permission is created here.
revoke select,truncate,references,trigger on public.profiles from anon,authenticated;
do $$ declare cols text; begin
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns
 where table_schema='public' and table_name='profiles' and column_name not in
 ('phone','national_address_code','totp_secret','admin_session_expires_at','failed_login_attempts','last_failed_login_at','password_changed_at');
 execute format('grant select(%s) on public.profiles to anon,authenticated',cols);
end $$;

create or replace function public.hayna_admin_security_profiles() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.hayna_has_permission('security') then raise exception 'permission_denied:security' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'display_name',display_name,'username',username,'avatar_url',avatar_url,'totp_enabled',totp_enabled,
  'failed_login_attempts',failed_login_attempts,'last_failed_login_at',last_failed_login_at,'admin_session_expires_at',admin_session_expires_at,'password_changed_at',password_changed_at)),'[]'::jsonb)
  from public.profiles where role in ('admin','moderator'));
end $$;
revoke all on function public.hayna_admin_security_profiles() from public,anon;
grant execute on function public.hayna_admin_security_profiles() to authenticated;

create or replace function public.hayna_admin_set_profile_role(p_target uuid,p_role text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.hayna_has_permission('roles') then raise exception 'permission_denied:roles' using errcode='42501'; end if;
 if p_role not in ('user','moderator','admin') or p_target is null then raise exception 'invalid_role' using errcode='22023'; end if;
 -- The core protected-field trigger enforces last-owner rules even through SECURITY DEFINER.
 update public.profiles set role=p_role where id=p_target;
 if not found then raise exception 'user_not_found' using errcode='22023'; end if;
 insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata)
 values(auth.uid(),'admin_profile_role_changed','user',p_target,jsonb_build_object('role',p_role));
end $$;
revoke all on function public.hayna_admin_set_profile_role(uuid,text) from public,anon;
grant execute on function public.hayna_admin_set_profile_role(uuid,text) to authenticated;

-- Every existing privileged RPC retains its implementation but gains a specific boundary.
-- Editing in place preserves its arguments, return type, grants and dependent callers.
do $block$
declare item record; fn regprocedure; definition text; guard text;
begin
 for item in select * from(values
  ('admin_generate_weekly_report','analytics'),('admin_platform_health','security'),('admin_enable_2fa','security'),
  ('admin_disable_2fa','security'),('admin_validate_session','security'),('admin_password_expired','security'),
  ('admin_reset_failed_logins','security'),('admin_reset_user_login_attempts','security'),('admin_record_failed_login','security'),
  ('admin_global_search','search'),('admin_review_verification','verifications'),('hayna_set_page_background','config')
 ) v(name,permission_key) loop
  for fn in select p.oid::regprocedure from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=item.name and p.prokind='f' loop
   definition:=pg_get_functiondef(fn);
   guard:=format(E'\n if not public.hayna_has_permission(%L) then raise exception ''permission_denied:%s'' using errcode=''42501''; end if;\n',item.permission_key,item.permission_key);
   definition:=regexp_replace(definition,'\mbegin\M',E'begin'||guard,'i');
   -- The precise permission above replaces the legacy generic role check.
   definition:=replace(definition,'perform public.assert_is_admin();','');
   definition:=replace(definition,'if not public.hayna_is_staff(v_actor) then','if not public.hayna_has_permission(''verifications'') then');
   execute definition;
  end loop;
 end loop;
end $block$;

-- Authentication bookkeeping is private even when invoked from SECURITY DEFINER.
create or replace function public.guard_profile_authentication_fields() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then return new;end if;
 if row(new.totp_enabled,new.totp_secret,new.admin_session_expires_at,new.failed_login_attempts,new.last_failed_login_at,new.password_changed_at)
 is distinct from row(old.totp_enabled,old.totp_secret,old.admin_session_expires_at,old.failed_login_attempts,old.last_failed_login_at,old.password_changed_at)
 and not public.hayna_has_permission('security') then raise exception 'permission_denied:security' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.guard_profile_authentication_fields() from public,anon,authenticated;

-- Protect the broad legacy entity RPC; permission to read reports is not a delete grant.
do $block$
declare fn regprocedure; definition text;guard text;
begin
 fn:=to_regprocedure('public.admin_update_platform_entity(text,uuid,text)');
 if fn is not null then
  definition:=pg_get_functiondef(fn);
  guard:=E'\n if not public.hayna_has_permission(case when p_entity=''service'' then ''market'' when p_entity=''urgent_alert'' then ''alerts'' else ''content'' end) then raise exception ''permission_denied:entity'' using errcode=''42501''; end if;\n';
  definition:=regexp_replace(definition,'\mbegin\M',E'begin'||guard,'i');
  definition:=replace(definition,'perform public.assert_is_admin();','');
  definition:=regexp_replace(definition,E'if v_actor is null or not exists \\(select 1 from public.profiles where id = v_actor and role = ''admin''\\) then[[:space:]]*raise exception ''admin access required'' using errcode = ''42501'';[[:space:]]*end if;','','i');
  execute definition;
 end if;
 fn:=to_regprocedure('public.admin_moderate_report(uuid,text,boolean)');
 if fn is not null then
  definition:=pg_get_functiondef(fn);
  guard:=E'\n if not public.hayna_has_permission(''reports'') then raise exception ''permission_denied:reports'' using errcode=''42501'';end if;\n';
  definition:=regexp_replace(definition,'\mbegin\M',E'begin'||guard,'i');
  definition:=replace(definition,'perform public.assert_is_admin();','');
  definition:=regexp_replace(definition,E'if v_actor is null or not exists \\(select 1 from public.profiles where id = v_actor and role = ''admin''\\) then[[:space:]]*raise exception ''admin access required'' using errcode = ''42501'';[[:space:]]*end if;','','i');
  definition:=replace(definition,'if p_delete_content then',E'if p_delete_content then\n if not public.hayna_has_permission(case when v_report.target_type=''service'' then ''market'' when v_report.target_type=''urgent_alert'' then ''alerts'' when v_report.target_type=''event'' then ''events'' else ''content'' end) then raise exception ''permission_denied:delete_content'' using errcode=''42501'';end if;');
  execute definition;
 end if;
end $block$;

-- Legacy user RPC must not return protected profile columns in its composite response.
create or replace function public.admin_update_user(p_target_user uuid,p_role text,p_is_verified boolean,p_is_geoverified boolean,p_is_banned boolean)
returns public.profiles language plpgsql security definer set search_path=pg_catalog as $$
declare target public.profiles; result public.profiles;
begin
 if not(public.hayna_has_permission('users') or public.hayna_has_permission('roles') or public.hayna_has_permission('verifications')) then raise exception 'permission_denied:users' using errcode='42501';end if;
 select * into target from public.profiles where id=p_target_user for update;
 if not found then raise exception 'user_not_found' using errcode='22023';end if;
 if p_role is null or p_role not in('user','moderator','admin') then raise exception 'invalid_role' using errcode='22023';end if;
 if p_role is distinct from target.role and not public.hayna_has_permission('roles') then raise exception 'permission_denied:roles' using errcode='42501';end if;
 if p_is_banned is distinct from target.is_banned and not public.hayna_has_permission('users') then raise exception 'permission_denied:users' using errcode='42501';end if;
 if (p_is_verified is distinct from target.is_verified or p_is_geoverified is distinct from target.is_geoverified) and not public.hayna_has_permission('verifications') then raise exception 'permission_denied:verifications' using errcode='42501';end if;
 if p_target_user=auth.uid() and (p_is_banned or p_role is distinct from target.role) then raise exception 'cannot_remove_own_access' using errcode='42501';end if;
 update public.profiles set role=p_role,is_verified=coalesce(p_is_verified,false),is_geoverified=coalesce(p_is_geoverified,false),is_banned=coalesce(p_is_banned,false),
 verification_status=case when coalesce(p_is_verified,false) then 'verified' else 'unverified' end,updated_at=now() where id=p_target_user returning * into result;
 insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata) values(auth.uid(),'admin_user_updated','user',p_target_user,jsonb_build_object('role',p_role,'verified',p_is_verified,'geoverified',p_is_geoverified,'banned',p_is_banned));
 return jsonb_populate_record(null::public.profiles,to_jsonb(result)-array['phone','national_address_code','totp_secret','admin_session_expires_at','failed_login_attempts','last_failed_login_at','password_changed_at']);
end $$;
revoke all on function public.admin_update_user(uuid,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_update_user(uuid,text,boolean,boolean,boolean) to authenticated;

-- Market administration is a capability, never an implicit profiles.role bypass.
do $block$
declare fn regprocedure; definition text; p record; criterion text;
begin
 fn:=to_regprocedure('public.hayna_my_account_capabilities()');
 if fn is not null then
  definition:=pg_get_functiondef(fn);
  definition:=replace(definition,'p.role=''admin''','public.hayna_has_permission(''market'')');
  definition:=replace(definition,'''can_publish_events'',not coalesce(p.is_banned,false) and (public.hayna_has_permission(''market'')','''can_publish_events'',not coalesce(p.is_banned,false) and (public.hayna_has_permission(''events'')');
  execute definition;
 end if;
 fn:=to_regprocedure('public.hayna_guard_market_publication()');
 if fn is not null then
  definition:=pg_get_functiondef(fn);
  definition:=replace(definition,'actor_admin := exists(select 1 from public.profiles where id=auth.uid() and role=''admin'' and not coalesce(is_banned,false));','actor_admin := public.hayna_has_permission(case when tg_table_name=''events'' then ''events'' else ''market'' end);');
  definition:=replace(definition,'p.role=''admin'' or case','actor_admin or case');
  definition:=replace(definition,'p.role<>''admin''','not actor_admin');
  execute definition;
 end if;
 foreach fn in array array[to_regprocedure('public.hayna_guard_business_moderation()'),to_regprocedure('public.hayna_sync_merchant_business()'),to_regprocedure('public.enforce_marketplace_moderation()')] loop
  if fn is not null then
   definition:=pg_get_functiondef(fn);
   definition:=replace(definition,'exists(select 1 from public.profiles where id=auth.uid() and role=''admin'')','public.hayna_has_permission(''market'')');
   definition:=regexp_replace(definition,'exists[[:space:]]*\([[:space:]]*select 1 from public.profiles p where p.id = auth.uid\(\) and p.role = ''admin''[[:space:]]*\)','public.hayna_has_permission(''market'')','i');
   execute definition;
  end if;
 end loop;
 -- Restrictive write guards intersect existing eligibility/ownership rules.
 for p in select * from(values('marketplace_items','seller_id'),('services','provider_id'),('businesses','owner_id')) v(tab,owner_col) loop
  if to_regclass('public.'||p.tab) is not null then
   criterion:=format('%I=(select auth.uid()) or public.hayna_has_permission(''market'')',p.owner_col);
   execute format('drop policy if exists hayna_market_update_scope on public.%I',p.tab);
   execute format('drop policy if exists hayna_market_delete_scope on public.%I',p.tab);
   execute format('create policy hayna_market_update_scope on public.%I as restrictive for update to authenticated using(%s) with check(%s)',p.tab,criterion,criterion);
   execute format('create policy hayna_market_delete_scope on public.%I as restrictive for delete to authenticated using(%s)',p.tab,criterion);
  end if;
 end loop;
end $block$;
create or replace function public.hayna_market_staff(p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select app_private.hayna_user_has_permission(p_user,'market');
$$;
revoke all on function public.hayna_market_staff(uuid) from public;
grant execute on function public.hayna_market_staff(uuid) to anon,authenticated;
do $block$
declare p record; q text; w text;
begin
 for p in select * from pg_policies where schemaname='public' and tablename in ('marketplace_items','services','businesses') loop
  q:=replace(p.qual,'hayna_is_staff(auth.uid())','hayna_has_permission(''market''::text)');
  w:=replace(p.with_check,'hayna_is_staff(auth.uid())','hayna_has_permission(''market''::text)');
  q:=replace(q,'p.role = ''admin''::text','public.hayna_market_staff(p.id)');
  w:=replace(w,'p.role = ''admin''::text','public.hayna_market_staff(p.id)');
  if q is distinct from p.qual then execute format('alter policy %I on public.%I using (%s)',p.policyname,p.tablename,q);end if;
  if w is distinct from p.with_check then execute format('alter policy %I on public.%I with check (%s)',p.policyname,p.tablename,w);end if;
 end loop;
 if to_regclass('public.businesses') is not null then
  drop policy if exists hayna_business_insert_scope on public.businesses;
  create policy hayna_business_insert_scope on public.businesses as restrictive for insert to authenticated with check(public.hayna_has_permission('market'));
 end if;
end $block$;
-- Column privacy also applies inside SECURITY INVOKER trigger functions. These two
-- checked entry points need only the privileged reads their implementation requires.
do $$ begin
 if to_regprocedure('public.hayna_guard_market_publication()') is not null then
  alter function public.hayna_guard_market_publication() security definer;
  alter function public.hayna_guard_market_publication() set search_path=pg_catalog;
 end if;
 if to_regprocedure('public.admin_review_verification(uuid,text)') is not null then
  alter function public.admin_review_verification(uuid,text) security definer;
 end if;
end $$;
-- Remove any old column-level grants too, not just the table-level SELECT grant.
do $$ declare cols text;begin
 select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name='profiles'
 and column_name in('phone','national_address_code','totp_secret','admin_session_expires_at','failed_login_attempts','last_failed_login_at','password_changed_at');
 if cols is not null then execute format('revoke select(%s) on public.profiles from public,anon,authenticated',cols);end if;
end $$;
-- Device tokens belong to one recipient. Knowing another profile ID is not a push grant.
do $$ declare p record;begin
 if to_regclass('public.push_tokens') is not null then
  revoke truncate,references,trigger on public.push_tokens from anon,authenticated;
  for p in select policyname from pg_policies where schemaname='public' and tablename='push_tokens' loop execute format('drop policy %I on public.push_tokens',p.policyname);end loop;
  alter table public.push_tokens enable row level security;
  create policy hayna_own_push_tokens on public.push_tokens for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
 end if;
 if to_regclass('public.notifications') is not null then
  revoke truncate,references,trigger on public.notifications from anon,authenticated;
  drop policy if exists admin_notifications_select on public.notifications;
  drop policy if exists admin_notifications_insert on public.notifications;
  create policy hayna_authorized_notifications_insert on public.notifications for insert to authenticated with check(public.hayna_has_permission('broadcast'));
 end if;
end $$;


commit;

