create or replace function public.guard_profile_authentication_fields()
returns trigger language plpgsql set search_path='' as $guard$
begin
 if auth.uid() is null then return new; end if;
 if row(new.totp_enabled,new.totp_secret,new.admin_session_expires_at,new.failed_login_attempts,new.last_failed_login_at,new.password_changed_at)
  is distinct from row(old.totp_enabled,old.totp_secret,old.admin_session_expires_at,old.failed_login_attempts,old.last_failed_login_at,old.password_changed_at)
 then perform public.assert_is_admin(); end if;
 return new;
end $guard$;
revoke all on function public.guard_profile_authentication_fields() from public,anon,authenticated;
create trigger guard_profile_authentication_fields before update on public.profiles
 for each row execute function public.guard_profile_authentication_fields();
