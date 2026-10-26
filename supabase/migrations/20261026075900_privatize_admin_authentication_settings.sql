create table app_private.admin_totp_secrets(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 secret text not null,updated_at timestamptz not null default now());
alter table app_private.admin_totp_secrets enable row level security;
revoke all on app_private.admin_totp_secrets from public,anon,authenticated;
insert into app_private.admin_totp_secrets(user_id,secret)
 select id,totp_secret from public.profiles where totp_secret is not null;
update public.profiles set totp_secret=null where totp_secret is not null;
alter table public.profiles add constraint profiles_totp_secret_private check(totp_secret is null);
create or replace function public.admin_enable_2fa(p_user_id uuid,p_secret text)
returns void language plpgsql security definer set search_path='' as $enable$
begin
 perform public.assert_is_admin();
 if p_secret is null or length(trim(p_secret))=0 then raise exception 'Secret required' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and role='admin' and not is_banned) then
  raise exception 'Active admin required' using errcode='42501';
 end if;
 insert into app_private.admin_totp_secrets(user_id,secret) values(p_user_id,p_secret)
  on conflict(user_id) do update set secret=excluded.secret,updated_at=now();
 update public.profiles set totp_enabled=true,totp_secret=null where id=p_user_id;
end $enable$;
create or replace function public.admin_disable_2fa(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $disable$
begin
 perform public.assert_is_admin();
 delete from app_private.admin_totp_secrets where user_id=p_user_id;
 update public.profiles set totp_enabled=false,totp_secret=null where id=p_user_id;
end $disable$;
revoke all on function public.admin_enable_2fa(uuid,text),public.admin_disable_2fa(uuid) from public,anon;
grant execute on function public.admin_enable_2fa(uuid,text),public.admin_disable_2fa(uuid) to authenticated;
-- Atomic compatibility check: every fixture and its notification/HTTP queue writes
-- are rolled back in the subtransaction. Failure aborts the migration.
do $compat$
declare previous_claims text:=current_setting('request.jwt.claims',true);
begin
 begin
  perform set_config('request.jwt.claims','{}',true);
  insert into auth.users(id,email,raw_user_meta_data) values
   ('fb000000-0000-4000-8000-000000000090','auth-audit-admin@example.invalid','{"username":"backend_auth_audit_admin"}'),
   ('fb000000-0000-4000-8000-000000000091','auth-audit-user@example.invalid','{"username":"backend_auth_audit_user"}');
  update public.profiles set role='admin' where id='fb000000-0000-4000-8000-000000000090';
  perform set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
  begin
   perform public.admin_enable_2fa('fb000000-0000-4000-8000-000000000090','AUDIT_ONLY');
   raise exception 'Non-admin enabled 2FA';
  exception when insufficient_privilege then null; end;
  begin
   update public.profiles set totp_enabled=true where id='fb000000-0000-4000-8000-000000000091';
   raise exception 'Self-service authentication field bypass';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{"sub":"fb000000-0000-4000-8000-000000000090","role":"authenticated"}',true);
  perform public.admin_enable_2fa('fb000000-0000-4000-8000-000000000090','AUDIT_ONLY');
  if not exists(select 1 from public.profiles where id='fb000000-0000-4000-8000-000000000090' and totp_enabled and totp_secret is null)
    or not exists(select 1 from app_private.admin_totp_secrets where user_id='fb000000-0000-4000-8000-000000000090' and secret='AUDIT_ONLY')
    or has_table_privilege('authenticated','app_private.admin_totp_secrets','SELECT')
  then raise exception '2FA confidentiality/compatibility check failed'; end if;
  perform public.admin_disable_2fa('fb000000-0000-4000-8000-000000000090');
  if exists(select 1 from app_private.admin_totp_secrets where user_id='fb000000-0000-4000-8000-000000000090')
    or exists(select 1 from public.profiles where id='fb000000-0000-4000-8000-000000000090' and totp_enabled)
  then raise exception '2FA disable compatibility check failed'; end if;
  raise exception 'Roll back compatibility fixtures' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null;
 end;
 perform set_config('request.jwt.claims',coalesce(previous_claims,'{}'),true);
end $compat$;
