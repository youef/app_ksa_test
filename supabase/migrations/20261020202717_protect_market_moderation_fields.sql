
-- Owners may edit their content, but moderation/trust fields remain staff-controlled.

create or replace function public.hayna_guard_business_sensitive_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;
  end if;

  if public.hayna_is_staff(v_uid) then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
     or new.is_verified is distinct from old.is_verified
     or new.moderation_status is distinct from old.moderation_status
  then
    raise exception 'business_sensitive_fields_require_admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.hayna_guard_business_sensitive_fields() from public, anon, authenticated;

drop trigger if exists businesses_guard_sensitive_fields on public.businesses;
create trigger businesses_guard_sensitive_fields
before update of owner_id, is_verified, moderation_status
on public.businesses
for each row
execute function public.hayna_guard_business_sensitive_fields();

drop policy if exists "business owner/admin update restriction" on public.businesses;
create policy "business verified owner or staff update"
on public.businesses
for update
to authenticated
using (
  public.hayna_is_staff(auth.uid())
  or (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_verified
        and p.account_type = 'merchant'
    )
  )
)
with check (
  public.hayna_is_staff(auth.uid())
  or (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_verified
        and p.account_type = 'merchant'
    )
  )
);

create or replace function public.hayna_guard_service_sensitive_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;
  end if;

  if public.hayna_is_staff(v_uid) then
    return new;
  end if;

  if new.provider_id is distinct from old.provider_id
     or new.moderation_status is distinct from old.moderation_status
     or new.is_verified is distinct from old.is_verified
  then
    raise exception 'service_sensitive_fields_require_admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.hayna_guard_service_sensitive_fields() from public, anon, authenticated;

drop trigger if exists services_guard_sensitive_fields on public.services;
create trigger services_guard_sensitive_fields
before update of provider_id, moderation_status, is_verified
on public.services
for each row
execute function public.hayna_guard_service_sensitive_fields();

drop policy if exists "Providers and admins can update services" on public.services;
create policy "professional provider or staff update services"
on public.services
for update
to authenticated
using (
  public.hayna_is_staff(auth.uid())
  or (
    provider_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_verified
        and p.account_type in ('merchant','freelance','provider')
    )
  )
)
with check (
  public.hayna_is_staff(auth.uid())
  or (
    provider_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_verified
        and p.account_type in ('merchant','freelance','provider')
    )
  )
);
