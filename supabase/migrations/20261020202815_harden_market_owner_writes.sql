
create or replace function public.hayna_guard_business_sensitive_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Allow controlled updates issued by trusted parent triggers such as
  -- profile -> business lifecycle synchronization.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

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

create or replace function public.hayna_guard_service_sensitive_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Account lifecycle synchronization performs nested service updates.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

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

drop policy if exists "services insert professional own" on public.services;
create policy "services insert professional own"
on public.services
for insert
to authenticated
with check (
  provider_id = auth.uid()
  and is_verified = false
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.is_verified and p.account_type in ('merchant','freelance','provider'))
      )
  )
);

create or replace function public.hayna_ensure_my_business()
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_business_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if not (
    v_profile.role = 'admin'
    or (v_profile.is_verified and v_profile.account_type = 'merchant')
  ) then
    raise exception 'merchant_account_required' using errcode = '42501';
  end if;

  select id into v_business_id
  from public.businesses
  where owner_id = v_uid
  limit 1;

  if v_business_id is not null then
    update public.businesses
    set name = coalesce(nullif(btrim(v_profile.freelance_trade), ''), v_profile.display_name),
        city = coalesce(nullif(btrim(v_profile.city), ''), city, 'غير محدد'),
        district = coalesce(nullif(btrim(v_profile.district), ''), district),
        updated_at = now()
    where id = v_business_id;
    return v_business_id;
  end if;

  insert into public.businesses(
    owner_id, name, description, city, district,
    is_verified, moderation_status
  )
  values(
    v_uid,
    coalesce(nullif(btrim(v_profile.freelance_trade), ''), v_profile.display_name),
    'الصفحة التجارية الرسمية لهذا الحساب في حيّنا.',
    coalesce(nullif(btrim(v_profile.city), ''), 'غير محدد'),
    nullif(btrim(v_profile.district), ''),
    true,
    'approved'
  )
  returning id into v_business_id;

  return v_business_id;
end;
$$;

revoke all on function public.hayna_ensure_my_business() from public, anon;
grant execute on function public.hayna_ensure_my_business() to authenticated;
