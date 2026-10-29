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
