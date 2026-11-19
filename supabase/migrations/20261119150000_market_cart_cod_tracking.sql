-- Hayna product cart and cash-on-delivery workflow.
-- Reuses the existing product-request RPC, DM controls, status history, and reviews.
-- Does NOT touch the separately paid marketplace promotions/subscriptions.

create table if not exists public.hayna_market_cart_items (
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.marketplace_items(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 20),
  expected_price numeric(12,2),
  fulfillment text not null check (char_length(fulfillment) between 1 and 80),
  note text not null default '' check (char_length(note) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (buyer_id, item_id),
  constraint hayna_cart_price_valid check (expected_price is null or expected_price between 0 and 9999999)
);
create index if not exists hayna_market_cart_item_idx on public.hayna_market_cart_items(item_id);
alter table public.hayna_market_cart_items enable row level security;
revoke all on public.hayna_market_cart_items from public, anon, authenticated;
grant select on public.hayna_market_cart_items to authenticated;
drop policy if exists "hayna_cart_owner_read" on public.hayna_market_cart_items;
create policy "hayna_cart_owner_read" on public.hayna_market_cart_items for select to authenticated
 using (buyer_id = (select auth.uid()) and public.hayna_account_is_active((select auth.uid())));

create table if not exists public.hayna_market_cart_checkouts (
  id uuid primary key,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists hayna_market_cart_checkouts_buyer_idx on public.hayna_market_cart_checkouts(buyer_id,created_at desc);
alter table public.hayna_market_cart_checkouts enable row level security;
revoke all on public.hayna_market_cart_checkouts from public, anon, authenticated;
grant select on public.hayna_market_cart_checkouts to authenticated;
drop policy if exists "hayna_cart_checkout_owner_read" on public.hayna_market_cart_checkouts;
create policy "hayna_cart_checkout_owner_read" on public.hayna_market_cart_checkouts for select to authenticated
 using (buyer_id = (select auth.uid()) and public.hayna_account_is_active((select auth.uid())));

alter table public.marketplace_product_requests
  add column if not exists payment_method text not null default 'cash_on_delivery',
  add column if not exists cash_collected_at timestamptz,
  add column if not exists scheduled_delivery_at timestamptz,
  add column if not exists delivery_note text not null default '';
do $$
begin
  if not exists(select 1 from pg_constraint where conname='hayna_product_cod_only' and conrelid='public.marketplace_product_requests'::regclass) then
    alter table public.marketplace_product_requests add constraint hayna_product_cod_only check (payment_method='cash_on_delivery');
  end if;
  if not exists(select 1 from pg_constraint where conname='hayna_product_delivery_note_length' and conrelid='public.marketplace_product_requests'::regclass) then
    alter table public.marketplace_product_requests add constraint hayna_product_delivery_note_length check (char_length(delivery_note) <= 500);
  end if;
end $$;

create or replace function public.hayna_market_cart_set(p_item uuid, p_quantity integer default 1, p_fulfillment text default null, p_note text default '')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid := auth.uid(); product public.marketplace_items; options text[]; method text; result public.hayna_market_cart_items;
begin
  if actor is null or not public.hayna_account_is_active(actor) then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_item is null or p_quantity is null or p_quantity not between 1 and 20 or p_note is null or char_length(p_note)>400 then
    raise exception 'invalid_cart_item' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hayna_cart:'||actor::text,0));
  select * into product from public.marketplace_items where id=p_item for share;
  if not found or product.status<>'available' then raise exception 'product_unavailable' using errcode='22023';end if;
  if product.seller_id=actor or not app_private.can_browse_regional_product(product.seller_id) or not public.hayna_can_dm(actor,product.seller_id) then
    raise exception 'product_contact_restricted' using errcode='42501';end if;
  options:=app_private.product_request_fulfillments(product.description);
  method:=coalesce(nullif(btrim(p_fulfillment),''),options[1]);
  if method is null or not(method=any(options)) then raise exception 'product_fulfillment_changed' using errcode='22023';end if;
  if not exists(select 1 from public.hayna_market_cart_items where buyer_id=actor and item_id=p_item)
    and (select count(*) from public.hayna_market_cart_items where buyer_id=actor)>=12 then
    raise exception 'cart_limit_12_items' using errcode='22023';end if;
  insert into public.hayna_market_cart_items(buyer_id,item_id,quantity,expected_price,fulfillment,note)
    values(actor,p_item,p_quantity,product.price,method,btrim(p_note))
    on conflict(buyer_id,item_id) do update set
      quantity=excluded.quantity, expected_price=excluded.expected_price,fulfillment=excluded.fulfillment,
      note=excluded.note,updated_at=now()
    returning * into result;
  return to_jsonb(result);
end $$;

create or replace function public.hayna_market_cart_remove(p_item uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.hayna_account_is_active(actor) then raise exception 'authentication_required' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('hayna_cart:'||actor::text,0));
  delete from public.hayna_market_cart_items where buyer_id=actor and item_id=p_item;
  return found;
end $$;

-- Entire checkout (including item-specific chat messages) is one PostgreSQL transaction.
-- A stable batch UUID allows safe retries after a network interruption.
create or replace function public.hayna_market_cart_checkout(p_batch uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid := auth.uid(); prior public.hayna_market_cart_checkouts;
  line public.hayna_market_cart_items; result jsonb; orders jsonb:='[]'::jsonb; n integer;
begin
  if actor is null or not public.hayna_account_is_active(actor) then raise exception 'authentication_required' using errcode='42501';end if;
  if p_batch is null then raise exception 'invalid_checkout_reference' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('hayna_cart:'||actor::text,0));
  select * into prior from public.hayna_market_cart_checkouts where id=p_batch for update;
  if found then
    if prior.buyer_id<>actor then raise exception 'checkout_reference_forbidden' using errcode='42501';end if;
    return prior.result;
  end if;
  select count(*) into n from public.hayna_market_cart_items where buyer_id=actor;
  if n<1 or n>12 then raise exception 'empty_cart_or_limit_exceeded' using errcode='22023';end if;
  for line in select * from public.hayna_market_cart_items where buyer_id=actor order by item_id for update loop
    result:=public.hayna_create_product_request(gen_random_uuid(),line.item_id,line.quantity,line.note,line.fulfillment,line.expected_price);
    if result->'request'->>'id' is null then raise exception 'checkout_order_not_created' using errcode='23514';end if;
    orders:=orders||jsonb_build_array(jsonb_build_object(
      'id',result->'request'->>'id','item_id',line.item_id,'seller_id',result->'request'->>'seller_id'
    ));
  end loop;
  result:=jsonb_build_object('checkout_id',p_batch,'payment_method','cash_on_delivery','orders',orders);
  insert into public.hayna_market_cart_checkouts(id,buyer_id,result) values(p_batch,actor,result);
  delete from public.hayna_market_cart_items where buyer_id=actor;
  return result;
end $$;

-- Seller can coordinate a delivery time; no home address or precise coordinates are stored.
create or replace function public.hayna_product_order_update_delivery(p_order uuid,p_delivery_at timestamptz,p_note text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not public.hayna_account_is_active(actor) then raise exception 'authentication_required' using errcode='42501';end if;
  if p_note is null or char_length(p_note)>500 or (p_delivery_at is not null and p_delivery_at<now()) then
    raise exception 'invalid_delivery_update' using errcode='22023';end if;
  update public.marketplace_product_requests set scheduled_delivery_at=p_delivery_at, delivery_note=btrim(p_note), updated_at=now()
    where id=p_order and seller_id=actor and status in ('accepted','ready');
  if not found then raise exception 'permission_denied_or_closed' using errcode='42501';end if;
end $$;

-- This records the seller's declaration of physical cash collection. It never charges a card.
create or replace function public.hayna_product_order_record_cash(p_order uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not public.hayna_account_is_active(actor) then raise exception 'authentication_required' using errcode='42501';end if;
  update public.marketplace_product_requests set cash_collected_at=coalesce(cash_collected_at,now()),updated_at=now()
    where id=p_order and seller_id=actor and status in ('ready','completed') and unit_price>0 and payment_method='cash_on_delivery';
  if not found then raise exception 'payment_not_due_or_permission_denied' using errcode='42501';end if;
end $$;

revoke all on function public.hayna_market_cart_set(uuid,integer,text,text) from public,anon;
revoke all on function public.hayna_market_cart_remove(uuid) from public,anon;
revoke all on function public.hayna_market_cart_checkout(uuid) from public,anon;
revoke all on function public.hayna_product_order_update_delivery(uuid,timestamptz,text) from public,anon;
revoke all on function public.hayna_product_order_record_cash(uuid) from public,anon;
grant execute on function public.hayna_market_cart_set(uuid,integer,text,text) to authenticated;
grant execute on function public.hayna_market_cart_remove(uuid) to authenticated;
grant execute on function public.hayna_market_cart_checkout(uuid) to authenticated;
grant execute on function public.hayna_product_order_update_delivery(uuid,timestamptz,text) to authenticated;
grant execute on function public.hayna_product_order_record_cash(uuid) to authenticated;
