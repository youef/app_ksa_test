
create or replace function public.hayna_sync_merchant_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_business_id uuid;
  v_professional boolean;
begin
  v_professional :=
    new.role = 'admin'
    or (new.is_verified and new.account_type in ('merchant','freelance','provider'));

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

    select id into v_business_id
    from public.businesses
    where owner_id = new.id
    limit 1;

    update public.services
    set business_id = v_business_id,
        updated_at = now()
    where provider_id = new.id
      and business_id is null;

    update public.marketplace_items
    set business_id = v_business_id,
        updated_at = now()
    where seller_id = new.id
      and business_id is null;

  elsif tg_op = 'UPDATE'
    and old.account_type = 'merchant'
    and new.account_type <> 'merchant'
  then
    update public.businesses
    set is_verified = false,
        moderation_status = 'hidden',
        updated_at = now()
    where owner_id = new.id;

    update public.services
    set business_id = null,
        updated_at = now()
    where provider_id = new.id;

    update public.marketplace_items
    set business_id = null,
        item_type = case when item_type = 'منتج تجاري' then 'بيع' else item_type end,
        updated_at = now()
    where seller_id = new.id;
  end if;

  if not v_professional then
    update public.services
    set moderation_status = case
          when moderation_status = 'approved' then 'pending'
          else moderation_status
        end,
        activity_status = 'inactive',
        updated_at = now()
    where provider_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.hayna_sync_merchant_business() from public, anon, authenticated;
