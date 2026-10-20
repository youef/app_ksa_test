-- Unified account -> business -> listings relationships and publishing permissions.

alter table public.services
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

alter table public.marketplace_items
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists services_business_id_idx on public.services(business_id);
create index if not exists marketplace_items_business_id_idx on public.marketplace_items(business_id);
create unique index if not exists businesses_one_owner_idx
  on public.businesses(owner_id)
  where owner_id is not null;

create or replace function public.hayna_my_account_capabilities()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'user_id', p.id,
      'role', p.role,
      'account_type', p.account_type,
      'is_verified', p.is_verified,
      'is_verified_merchant', p.is_verified_merchant,
      'can_sell_personal', true,
      'can_publish_products', (p.role = 'admin' or p.account_type in ('standard','merchant')),
      'can_publish_services', (p.role = 'admin' or (p.is_verified and p.account_type in ('merchant','freelance','provider'))),
      'can_manage_business', (p.role = 'admin' or (p.is_verified and p.account_type = 'merchant')),
      'can_promote', (p.role = 'admin' or (p.is_verified and p.account_type in ('merchant','freelance','provider'))),
      'professional_name', nullif(btrim(p.freelance_trade), '')
    )
    from public.profiles p
    where p.id = auth.uid()
  ), '{}'::jsonb);
$$;

grant execute on function public.hayna_my_account_capabilities() to authenticated;

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
        is_verified = true,
        moderation_status = 'approved',
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

grant execute on function public.hayna_ensure_my_business() to authenticated;

-- Publishing services is a professional capability. Existing owners keep update/delete access.
drop policy if exists "services insert own" on public.services;
create policy "services insert professional own"
on public.services
for insert
to authenticated
with check (
  provider_id = auth.uid()
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

-- A business page belongs to one verified merchant account.
drop policy if exists "business owner insert" on public.businesses;
drop policy if exists "business owner write restriction" on public.businesses;
drop policy if exists "businesses insert own" on public.businesses;
create policy "business verified merchant insert"
on public.businesses
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.is_verified and p.account_type = 'merchant')
      )
  )
);

create or replace function public.hayna_validate_service_business()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business uuid;
begin
  if new.business_id is null then
    select id into v_business
    from public.businesses
    where owner_id = new.provider_id
    limit 1;
    new.business_id := v_business;
  elsif not exists (
    select 1 from public.businesses b
    where b.id = new.business_id and b.owner_id = new.provider_id
  ) then
    raise exception 'business_does_not_belong_to_provider' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists services_validate_business on public.services;
create trigger services_validate_business
before insert or update of business_id, provider_id
on public.services
for each row execute function public.hayna_validate_service_business();

create or replace function public.hayna_validate_market_business()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business uuid;
begin
  if new.business_id is null then
    select id into v_business
    from public.businesses
    where owner_id = new.seller_id
    limit 1;
    new.business_id := v_business;
  elsif not exists (
    select 1 from public.businesses b
    where b.id = new.business_id and b.owner_id = new.seller_id
  ) then
    raise exception 'business_does_not_belong_to_seller' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_items_validate_business on public.marketplace_items;
create trigger marketplace_items_validate_business
before insert or update of business_id, seller_id
on public.marketplace_items
for each row execute function public.hayna_validate_market_business();

-- Keep the merchant business lifecycle synchronized with the approved account identity.
create or replace function public.hayna_sync_merchant_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.account_type = 'merchant' and new.is_verified then
    v_name := coalesce(nullif(btrim(new.freelance_trade), ''), new.display_name);
    insert into public.businesses(
      owner_id, name, description, city, district,
      is_verified, moderation_status
    )
    values(
      new.id,
      v_name,
      'الصفحة التجارية الرسمية لهذا الحساب في حيّنا.',
      coalesce(nullif(btrim(new.city), ''), 'غير محدد'),
      nullif(btrim(new.district), ''),
      true,
      'approved'
    )
    on conflict (owner_id) where owner_id is not null
    do update set
      name = excluded.name,
      city = excluded.city,
      district = excluded.district,
      is_verified = true,
      moderation_status = 'approved',
      updated_at = now();
  elsif old.account_type = 'merchant' and new.account_type <> 'merchant' then
    update public.businesses
    set is_verified = false,
        moderation_status = 'hidden',
        updated_at = now()
    where owner_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.hayna_sync_merchant_business() from public, anon, authenticated;

drop trigger if exists profiles_sync_merchant_business on public.profiles;
create trigger profiles_sync_merchant_business
after insert or update of account_type, is_verified, freelance_trade, display_name, city, district
on public.profiles
for each row execute function public.hayna_sync_merchant_business();

-- Backfill links where a merchant business already exists.
update public.services s
set business_id = b.id
from public.businesses b
where b.owner_id = s.provider_id
  and s.business_id is null;

update public.marketplace_items m
set business_id = b.id
from public.businesses b
where b.owner_id = m.seller_id
  and m.business_id is null;
