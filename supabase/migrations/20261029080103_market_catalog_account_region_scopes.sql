-- Add general region metadata; do not change cities, coordinates, ownership or payment state.
begin;
create or replace function public.hayna_market_place_key(p_value text) returns text
language sql immutable strict parallel safe security invoker set search_path=pg_catalog as $$
 select lower(translate(regexp_replace(regexp_replace(regexp_replace(trim(p_value),'^(مدينة|حي|منطقة)[[:space:]]+',''),'[ً-ٰٟـ]','','g'),'[[:space:]]+',' ','g'),'أإآٱةى','ااااهي'));
$$;
revoke all on function public.hayna_market_place_key(text) from public,anon;
grant execute on function public.hayna_market_place_key(text) to authenticated;
alter table public.marketplace_items add column if not exists region text;
alter table public.services add column if not exists region text;
alter table public.businesses add column if not exists region text;
alter table public.events add column if not exists region text;

create or replace function app_private.hayna_market_region_snapshot() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_city text; v_region text;
begin
 v_actor:=nullif(to_jsonb(new)->>tg_argv[0],'')::uuid;
 if v_actor is null then
  if auth.uid() is null or public.hayna_is_staff(auth.uid()) then new.region:=nullif(trim(new.region),'');else new.region:=null;end if;
  return new;
 end if;
 select p.city,p.region into v_city,v_region from public.profiles p where p.id=v_actor;
 new.region:=case when public.hayna_market_place_key(new.city)=public.hayna_market_place_key(v_city)
  and coalesce(trim(v_region),'') not in ('','الكل','كل المملكة','المملكة','المملكة العربية السعودية')
  then trim(v_region) else null end;
 return new;
end $$;
revoke all on function app_private.hayna_market_region_snapshot() from public,anon,authenticated;

-- Existing rows receive only previously missing region metadata when their recorded
-- city matches the publisher's current registered city. Ambiguous/unmatched rows stay unknown.
update public.marketplace_items t set region=p.region from public.profiles p where t.region is null and p.id=t.seller_id and public.hayna_market_place_key(t.city)=public.hayna_market_place_key(p.city) and coalesce(trim(p.region),'') not in ('','الكل','كل المملكة','المملكة','المملكة العربية السعودية');
update public.services t set region=p.region from public.profiles p where t.region is null and p.id=t.provider_id and public.hayna_market_place_key(t.city)=public.hayna_market_place_key(p.city) and coalesce(trim(p.region),'') not in ('','الكل','كل المملكة','المملكة','المملكة العربية السعودية');
update public.businesses t set region=p.region from public.profiles p where t.region is null and p.id=t.owner_id and public.hayna_market_place_key(t.city)=public.hayna_market_place_key(p.city) and coalesce(trim(p.region),'') not in ('','الكل','كل المملكة','المملكة','المملكة العربية السعودية');
update public.events t set region=p.region from public.profiles p where t.region is null and p.id=t.organizer_id and public.hayna_market_place_key(t.city)=public.hayna_market_place_key(p.city) and coalesce(trim(p.region),'') not in ('','الكل','كل المملكة','المملكة','المملكة العربية السعودية');

drop trigger if exists zz_hayna_market_region_snapshot on public.marketplace_items;
create trigger zz_hayna_market_region_snapshot before insert or update of city,district,region,seller_id on public.marketplace_items for each row execute function app_private.hayna_market_region_snapshot('seller_id');
drop trigger if exists zz_hayna_market_region_snapshot on public.services;
create trigger zz_hayna_market_region_snapshot before insert or update of city,district,region,provider_id on public.services for each row execute function app_private.hayna_market_region_snapshot('provider_id');
drop trigger if exists zz_hayna_market_region_snapshot on public.businesses;
create trigger zz_hayna_market_region_snapshot before insert or update of city,district,region,owner_id on public.businesses for each row execute function app_private.hayna_market_region_snapshot('owner_id');
drop trigger if exists zz_hayna_market_region_snapshot on public.events;
create trigger zz_hayna_market_region_snapshot before insert or update of city,district,region,organizer_id on public.events for each row execute function app_private.hayna_market_region_snapshot('organizer_id');

create or replace function public.hayna_market_catalog_page(p_source text,p_scope text default 'city',p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog as $$
declare v_user uuid:=auth.uid();v_profile record;v_city text;v_region text;v_district text;v_table text;v_column text;v_status text;v_rows jsonb;v_more boolean;v_label text;
begin
 if v_user is null then raise exception 'authentication_required' using errcode='42501';end if;
 if p_scope is null or p_scope not in ('district','city','region') or p_page is null or p_page<0 or p_page>1000 then raise exception 'invalid_market_scope' using errcode='22023';end if;
 select city,district,region into v_profile from public.profiles where id=v_user and not coalesce(is_banned,false);
 if not found or coalesce(trim(v_profile.city),'') in ('','كل المدن','جميع المدن','كل المملكة','الكل') then raise exception 'account_location_required' using errcode='22023';end if;
 if coalesce(trim(v_profile.region),'') in ('','الكل','كل المملكة','المملكة','المملكة العربية السعودية') then raise exception 'account_region_required' using errcode='22023';end if;
 v_region:=public.hayna_market_place_key(v_profile.region);
 v_city:=case when p_scope='region' then null else public.hayna_market_place_key(v_profile.city) end;
 v_label:=case when p_scope='region' then v_profile.region else v_profile.city end;
 if p_scope='district' then
  if coalesce(trim(v_profile.district),'') in ('','كل الأحياء','كل أحياء المدينة','جميع الأحياء','الكل') then raise exception 'account_district_required' using errcode='22023';end if;
  v_district:=public.hayna_market_place_key(v_profile.district);v_label:='حي '||v_profile.district||' · '||v_profile.city;
 end if;
 case p_source
  when 'products' then v_table:='marketplace_items';v_column:='status';v_status:='available';
  when 'services' then v_table:='services';v_column:='moderation_status';v_status:='approved';
  when 'businesses' then v_table:='businesses';v_column:='moderation_status';v_status:='approved';
  when 'events' then v_table:='events';v_column:='moderation_status';v_status:='approved';
  else raise exception 'invalid_market_source' using errcode='22023';
 end case;
 execute format('select coalesce(jsonb_agg(x.payload order by x.created_at desc,x.id desc),''[]''::jsonb) from (select to_jsonb(t)-array[''latitude'',''longitude'',''lat'',''lng'',''location_lat'',''location_lng''] as payload,t.created_at,t.id from public.%I t where t.%I=$1 and public.hayna_market_place_key(t.region)=$2 and ($3 is null or public.hayna_market_place_key(t.city)=$3) and ($4 is null or public.hayna_market_place_key(t.district)=$4) order by t.created_at desc,t.id desc offset $5 limit 61)x',v_table,v_column)
 into v_rows using v_status,v_region,v_city,v_district,p_page*60;
 v_more:=jsonb_array_length(v_rows)>60;if v_more then v_rows:=v_rows-60;end if;
 return jsonb_build_object('rows',v_rows,'has_more',v_more,'scope',p_scope,'label',v_label,'city',v_profile.city,'district',case when p_scope='district' then v_profile.district else null end,'region',v_profile.region);
end $$;
revoke all on function public.hayna_market_catalog_page(text,text,integer) from public,anon;
grant execute on function public.hayna_market_catalog_page(text,text,integer) to authenticated;
create index if not exists marketplace_items_region_scope_idx on public.marketplace_items(public.hayna_market_place_key(region),public.hayna_market_place_key(city),created_at desc,id desc) where status='available';
create index if not exists services_region_scope_idx on public.services(public.hayna_market_place_key(region),public.hayna_market_place_key(city),created_at desc,id desc) where moderation_status='approved';
create index if not exists businesses_region_scope_idx on public.businesses(public.hayna_market_place_key(region),public.hayna_market_place_key(city),created_at desc,id desc) where moderation_status='approved';
create index if not exists events_region_scope_idx on public.events(public.hayna_market_place_key(region),public.hayna_market_place_key(city),created_at desc,id desc) where moderation_status='approved';
commit;
