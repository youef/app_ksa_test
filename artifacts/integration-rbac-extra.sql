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
