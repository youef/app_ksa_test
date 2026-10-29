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
