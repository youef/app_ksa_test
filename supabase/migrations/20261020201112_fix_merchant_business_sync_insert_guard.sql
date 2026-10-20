
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
  elsif tg_op = 'UPDATE'
    and old.account_type = 'merchant'
    and new.account_type <> 'merchant'
  then
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
