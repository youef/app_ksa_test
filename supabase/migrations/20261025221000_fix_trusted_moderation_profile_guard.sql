-- Narrow exception for trusted nested moderation triggers; never grant clients the ability to change is_banned.
create or replace function public.guard_profile_sensitive_fields()
returns trigger language plpgsql set search_path = public
as $$
declare request_user uuid := auth.uid();
begin
  if request_user is null then return new; end if;
  if pg_trigger_depth() > 1
     and current_user = 'postgres'
     and new.id = old.id
     and new.is_banned = true and old.is_banned = false
     and new.role is not distinct from old.role
     and new.is_verified is not distinct from old.is_verified
     and new.is_verified_merchant is not distinct from old.is_verified_merchant
     and new.is_geoverified is not distinct from old.is_geoverified
     and new.is_verified_neighbor is not distinct from old.is_verified_neighbor
     and new.verification_method is not distinct from old.verification_method
     and new.verification_status is not distinct from old.verification_status
     and new.account_type is not distinct from old.account_type
  then return new; end if;
  if public.hayna_is_staff(request_user) then return new; end if;
  if new.role is distinct from old.role
     or new.is_verified is distinct from old.is_verified
     or new.is_verified_merchant is distinct from old.is_verified_merchant
     or new.is_geoverified is distinct from old.is_geoverified
     or new.is_verified_neighbor is distinct from old.is_verified_neighbor
     or new.is_banned is distinct from old.is_banned
     or new.verification_method is distinct from old.verification_method
     or new.verification_status is distinct from old.verification_status
     or (new.account_type is distinct from old.account_type and new.account_type is distinct from 'standard')
  then raise exception 'sensitive_profile_fields_require_admin_review' using errcode='42501'; end if;
  return new;
end;
$$;