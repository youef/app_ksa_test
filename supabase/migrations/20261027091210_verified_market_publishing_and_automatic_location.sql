-- Public eligibility is derived exclusively from protected profile fields.
create or replace function public.hayna_my_account_capabilities() returns jsonb
language sql stable security invoker set search_path = pg_catalog
as $$
select coalesce((select jsonb_build_object(
  'user_id',p.id,'role',p.role,'account_type',p.account_type,'is_verified',p.is_verified,
  'is_verified_merchant',p.is_verified_merchant,'can_sell_personal',false,
  'can_publish_products',not coalesce(p.is_banned,false) and (p.role='admin' or (p.account_type='merchant' and p.is_verified and p.is_verified_merchant)),
  'can_publish_services',not coalesce(p.is_banned,false) and (p.role='admin' or (p.is_verified and (p.account_type in ('freelance','provider') or (p.account_type='merchant' and p.is_verified_merchant)))),
  'can_publish_events',not coalesce(p.is_banned,false) and (p.role='admin' or (p.is_verified and (p.account_type in ('freelance','provider') or (p.account_type='merchant' and p.is_verified_merchant)))),
  'can_manage_business',not coalesce(p.is_banned,false) and p.account_type='merchant' and p.is_verified and p.is_verified_merchant,
  'can_promote',not coalesce(p.is_banned,false) and (p.role='admin' or (p.is_verified and (p.account_type in ('freelance','provider') or (p.account_type='merchant' and p.is_verified_merchant)))),
  'professional_name',nullif(btrim(p.freelance_trade),'')
) from public.profiles p where p.id=auth.uid()),'{}'::jsonb);
$$;

create or replace function public.hayna_ensure_my_business() returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare p public.profiles%rowtype; business_uuid uuid;
begin
  select * into p from public.profiles where id=auth.uid() for update;
  if not found or coalesce(p.is_banned,false) or p.account_type<>'merchant' or not p.is_verified or not p.is_verified_merchant then
    raise exception 'verified_merchant_required' using errcode='42501';
  end if;
  if nullif(btrim(p.city),'') is null or nullif(btrim(p.district),'') is null
     or p.city in ('كل المدن','كل المملكة','كل مناطق المملكة') or p.district in ('كل الأحياء','كل أحياء المدينة') then
    raise exception 'verified_profile_location_required' using errcode='22023';
  end if;
  insert into public.businesses(owner_id,name,description,city,district,is_verified,moderation_status)
    values(p.id,coalesce(nullif(btrim(p.freelance_trade),''),nullif(btrim(p.display_name),''),p.username,'منشأة حيّنا'),
      'الصفحة التجارية الرسمية لهذا الحساب في حيّنا.',btrim(p.city),btrim(p.district),true,'approved')
    on conflict(owner_id) where owner_id is not null do nothing;
  select id into business_uuid from public.businesses where owner_id=p.id;
  return business_uuid;
end;
$$;
revoke all on function public.hayna_ensure_my_business() from public, anon;
grant execute on function public.hayna_ensure_my_business() to authenticated;

create or replace function public.hayna_sync_merchant_business() returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$
declare business_uuid uuid; trusted_actor boolean;
begin
  trusted_actor := auth.uid() is null or exists(select 1 from public.profiles where id=auth.uid() and role='admin');
  if new.account_type='merchant' and new.is_verified and new.is_verified_merchant and not coalesce(new.is_banned,false) then
    insert into public.businesses(owner_id,name,description,city,district,is_verified,moderation_status)
      values(new.id,coalesce(nullif(btrim(new.freelance_trade),''),nullif(btrim(new.display_name),''),new.username,'منشأة حيّنا'),
        'الصفحة التجارية الرسمية لهذا الحساب في حيّنا.',coalesce(nullif(btrim(new.city),''),'غير محدد'),nullif(btrim(new.district),''),true,'approved')
      on conflict(owner_id) where owner_id is not null do nothing;
    select id into business_uuid from public.businesses where owner_id=new.id;
    if trusted_actor then
      update public.businesses set is_verified=true,moderation_status='approved',city=coalesce(nullif(btrim(new.city),''),city),district=nullif(btrim(new.district),''),updated_at=now() where id=business_uuid;
      update public.services set business_id=business_uuid where provider_id=new.id and business_id is null;
      update public.marketplace_items set business_id=business_uuid where seller_id=new.id and business_id is null;
    end if;
  elsif trusted_actor then
    update public.businesses set is_verified=false,moderation_status='hidden',updated_at=now() where owner_id=new.id;
  end if;
  -- Visibility policies below re-evaluate eligibility immediately after revocation.
  return new;
end;
$$;
revoke all on function public.hayna_sync_merchant_business() from public,anon,authenticated;
drop trigger if exists profiles_sync_merchant_business on public.profiles;
create trigger profiles_sync_merchant_business after insert or update of account_type,is_verified,is_verified_merchant,is_banned,freelance_trade,display_name,city,district
on public.profiles for each row execute function public.hayna_sync_merchant_business();

create or replace function public.hayna_guard_market_publication() returns trigger
language plpgsql security invoker set search_path = pg_catalog
as $$
declare p public.profiles%rowtype; owner_uuid uuid; actor_admin boolean; merchant boolean; professional boolean; business_uuid uuid;
begin
  actor_admin := exists(select 1 from public.profiles where id=auth.uid() and role='admin' and not coalesce(is_banned,false));
  -- Preserve administrative maintenance of legacy rows; public visibility still checks the owner.
  if tg_op='UPDATE' and (auth.uid() is null or actor_admin) then return new; end if;
  if tg_table_name='marketplace_items' then owner_uuid:=new.seller_id;
  elsif tg_table_name='services' then owner_uuid:=new.provider_id;
  else owner_uuid:=new.organizer_id; end if;
  select * into p from public.profiles where id=owner_uuid;
  merchant := p.account_type='merchant' and p.is_verified and p.is_verified_merchant and not coalesce(p.is_banned,false);
  professional := p.is_verified and (p.account_type in ('freelance','provider') or merchant) and not coalesce(p.is_banned,false);
  if not found or coalesce(p.is_banned,false) or not coalesce(p.role='admin' or case when tg_table_name='marketplace_items' then merchant else professional end,false) then
    raise exception 'verified_market_account_required' using errcode='42501';
  end if;
  if nullif(btrim(p.city),'') is null or nullif(btrim(p.district),'') is null
     or p.city in ('كل المدن','كل المملكة','كل مناطق المملكة') or p.district in ('كل الأحياء','كل أحياء المدينة') then
    raise exception 'verified_profile_location_required' using errcode='22023';
  end if;
  new.city:=btrim(p.city); new.district:=btrim(p.district);
  if tg_table_name in ('marketplace_items','services') then
    if merchant then
      select id into business_uuid from public.businesses where owner_id=owner_uuid;
      if business_uuid is null then raise exception 'merchant_business_required' using errcode='22023'; end if;
      new.business_id:=business_uuid;
    else new.business_id:=null; end if;
  end if;
  if tg_table_name='marketplace_items' and merchant then new.item_type:='منتج تجاري'; end if;
  if tg_table_name='services' then
    if new.listing_type in ('home_family','home_sale','shop','product_in_shop') and not merchant and p.role<>'admin' then
      raise exception 'commercial_listing_requires_merchant' using errcode='42501';
    end if;
  end if;
  if tg_table_name='events' and p.role<>'admin' then new.moderation_status:='pending'; end if;
  return new;
end;
$$;
revoke all on function public.hayna_guard_market_publication() from public,anon,authenticated;
create trigger aa_market_publication_guard before insert or update on public.marketplace_items for each row execute function public.hayna_guard_market_publication();
create trigger aa_service_publication_guard before insert or update on public.services for each row execute function public.hayna_guard_market_publication();
create trigger zz_event_publication_guard before insert or update on public.events for each row execute function public.hayna_guard_market_publication();

create or replace function public.hayna_guard_business_moderation() returns trigger
language plpgsql security invoker set search_path = pg_catalog
as $$ begin
  if auth.uid() is null or exists(select 1 from public.profiles where id=auth.uid() and role='admin') then return new; end if;
  -- Owner INSERT is permitted only through the checked ensure-business function;
  -- direct table inserts remain staff-only under RLS.
  if tg_op='INSERT' and new.owner_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='merchant' and p.is_verified and p.is_verified_merchant and not coalesce(p.is_banned,false)) then
    new.moderation_status:='approved'; new.is_verified:=true;
  else new.moderation_status:='pending'; end if;
  return new;
end $$;
revoke all on function public.hayna_guard_business_moderation() from public,anon,authenticated;
drop trigger if exists businesses_moderation_guard on public.businesses;
create trigger businesses_moderation_guard before insert or update on public.businesses for each row execute function public.hayna_guard_business_moderation();

-- Replace permissive, overlapping rules: permissive policies are ORed together.
do $$ declare p record; begin
  for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('marketplace_items','services','businesses','events') loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;

create policy "market verified seller visibility" on public.marketplace_items for select to anon,authenticated using (
  seller_id=auth.uid() or public.hayna_is_staff(auth.uid()) or exists(select 1 from public.profiles p where p.id=seller_id and not coalesce(p.is_banned,false) and (p.role='admin' or (p.account_type='merchant' and p.is_verified and p.is_verified_merchant)))
);
create policy "market verified seller insert" on public.marketplace_items for insert to authenticated with check (
  seller_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_products')::boolean,false)
);
create policy "market verified seller update" on public.marketplace_items for update to authenticated using (
  public.hayna_is_staff(auth.uid()) or (seller_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_products')::boolean,false))
) with check (public.hayna_is_staff(auth.uid()) or (seller_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_products')::boolean,false)));
create policy "market own or staff delete" on public.marketplace_items for delete to authenticated using(seller_id=auth.uid() or public.hayna_is_staff(auth.uid()));

create policy "service verified professional visibility" on public.services for select to anon,authenticated using (
  provider_id=auth.uid() or public.hayna_is_staff(auth.uid()) or (moderation_status='approved' and exists(select 1 from public.profiles p where p.id=provider_id and not coalesce(p.is_banned,false) and (p.role='admin' or (p.is_verified and (p.account_type in ('freelance','provider') or (p.account_type='merchant' and p.is_verified_merchant))))))
);
create policy "service verified professional insert" on public.services for insert to authenticated with check(provider_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_services')::boolean,false));
create policy "service verified professional update" on public.services for update to authenticated using(public.hayna_is_staff(auth.uid()) or (provider_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_services')::boolean,false)))
with check(public.hayna_is_staff(auth.uid()) or (provider_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_services')::boolean,false)));
create policy "service own or staff delete" on public.services for delete to authenticated using(provider_id=auth.uid() or public.hayna_is_staff(auth.uid()));

create policy "business verified merchant visibility" on public.businesses for select to anon,authenticated using (
  owner_id=auth.uid() or public.hayna_is_staff(auth.uid()) or (moderation_status='approved' and (owner_id is null or (is_verified and exists(select 1 from public.profiles p where p.id=owner_id and p.account_type='merchant' and p.is_verified and p.is_verified_merchant and not coalesce(p.is_banned,false)))))
);
create policy "business verified merchant update" on public.businesses for update to authenticated using(public.hayna_is_staff(auth.uid()) or (owner_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_manage_business')::boolean,false)))
with check(public.hayna_is_staff(auth.uid()) or (owner_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_manage_business')::boolean,false)));
create policy "business staff insert" on public.businesses for insert to authenticated with check(public.hayna_is_staff(auth.uid()));
create policy "business staff delete" on public.businesses for delete to authenticated using(public.hayna_is_staff(auth.uid()));

create policy "event approved eligible organizer visibility" on public.events for select to anon,authenticated using (
  organizer_id=auth.uid() or public.hayna_is_staff(auth.uid()) or (moderation_status='approved' and exists(select 1 from public.profiles p where p.id=organizer_id and not coalesce(p.is_banned,false) and (p.role='admin' or (p.is_verified and (p.account_type in ('freelance','provider') or (p.account_type='merchant' and p.is_verified_merchant))))))
);
create policy "event eligible organizer insert" on public.events for insert to authenticated with check(organizer_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_events')::boolean,false));
create policy "event eligible organizer update" on public.events for update to authenticated using(public.hayna_is_staff(auth.uid()) or (organizer_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_events')::boolean,false)))
with check(public.hayna_is_staff(auth.uid()) or (organizer_id=auth.uid() and coalesce((public.hayna_my_account_capabilities()->>'can_publish_events')::boolean,false)));
create policy "event own or staff delete" on public.events for delete to authenticated using(organizer_id=auth.uid() or public.hayna_is_staff(auth.uid()));

revoke truncate on public.marketplace_items,public.services,public.businesses,public.events from anon,authenticated;
