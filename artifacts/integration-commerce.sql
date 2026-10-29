-- Systems 1, 10, 11. Apply after permission RPC migration; test on an isolated DB first.
-- No production rows are deleted or silently deduplicated. Duplicate review preflight aborts.
begin;
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
commit;
