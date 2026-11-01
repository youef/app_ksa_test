begin;
create table public.marketplace_product_requests (
 id uuid primary key,
 message_id uuid unique references public.messages(id) on delete set null,
 conversation_id uuid references public.conversations(id) on delete set null,
 item_id uuid references public.marketplace_items(id) on delete set null,
 buyer_id uuid not null references public.profiles(id) on delete cascade,
 seller_id uuid not null references public.profiles(id) on delete cascade,
 item_title text not null,
 unit_price numeric(12,2) check(unit_price>=0 and unit_price<=9999999),
 quantity integer not null check(quantity between 1 and 20),
 fulfillment text not null check(char_length(fulfillment)<=80),
 note text not null default '' check(char_length(note)<=400),
 status text not null default 'pending' check(status in ('pending','accepted','ready','completed','rejected','cancelled')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(buyer_id<>seller_id)
);
create unique index product_request_active_reservation on public.marketplace_product_requests(item_id) where status in ('accepted','ready');
create index product_request_buyer on public.marketplace_product_requests(buyer_id,updated_at desc);
create index product_request_seller on public.marketplace_product_requests(seller_id,updated_at desc);
create index product_request_conversation on public.marketplace_product_requests(conversation_id,created_at desc);
create table public.marketplace_product_request_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.marketplace_product_requests(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null,
 version integer not null,
 snapshot jsonb not null,
 created_at timestamptz not null default now(),
 unique(request_id,version)
);
alter table public.marketplace_product_requests enable row level security;
alter table public.marketplace_product_request_events enable row level security;
revoke all on public.marketplace_product_requests,public.marketplace_product_request_events from public,anon,authenticated;
grant select on public.marketplace_product_requests,public.marketplace_product_request_events to authenticated;
create policy product_request_participant_read on public.marketplace_product_requests for select to authenticated
using ((buyer_id=auth.uid() or seller_id=auth.uid()) and public.hayna_account_is_active(auth.uid()));
create policy product_request_event_participant_read on public.marketplace_product_request_events for select to authenticated
using (exists(select 1 from public.marketplace_product_requests r where r.id=request_id));

create function app_private.product_request_fulfillments(p_description text) returns text[]
language sql immutable set search_path=pg_catalog as $$
 select case split_part(substring(coalesce(p_description,'') from E'\nالاستلام: ([^\n]+)'),E'\n',1)
 when 'استلام من الموقع' then array['استلام من الموقع']
 when 'توصيل بالتنسيق' then array['توصيل بالتنسيق']
 when 'استلام أو توصيل' then array['استلام من الموقع','توصيل بالتنسيق']
 else array['بالاتفاق مع البائع'] end
$$;
revoke all on function app_private.product_request_fulfillments(text) from public,anon,authenticated;

create function public.hayna_create_product_request(p_request uuid,p_item uuid,p_quantity integer,p_note text,p_fulfillment text,p_expected_price numeric) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); product public.marketplace_items; request public.marketplace_product_requests; chat uuid; legacy public.messages; message_text text;
begin
 if actor is null or not public.hayna_account_is_active(actor) then raise exception 'authentication_required' using errcode='42501';end if;
 if p_request is null or p_item is null or p_quantity is null or p_quantity not between 1 and 20 or p_note is null or char_length(p_note)>400 then raise exception 'invalid_product_request' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into request from public.marketplace_product_requests where id=p_request;
 if found then
  if request.buyer_id<>actor or request.item_id is distinct from p_item then raise exception 'product_request_forbidden' using errcode='42501';end if;
  return jsonb_build_object('conversationId',request.conversation_id,'reused',true,'request',to_jsonb(request));
 end if;
 select * into product from public.marketplace_items where id=p_item for update;
 if not found or product.status<>'available' then raise exception 'product_unavailable' using errcode='22023';end if;
 if product.seller_id=actor or not app_private.can_browse_regional_product(product.seller_id) or not public.hayna_can_dm(actor,product.seller_id) then raise exception 'product_contact_restricted' using errcode='42501';end if;
 if private.prohibited_story_word(jsonb_build_object('content',p_note)) is not null then raise exception 'product_request_note_rejected' using errcode='22023';end if;
 if p_expected_price is distinct from product.price then raise exception 'product_price_changed' using errcode='22023';end if;
 if p_fulfillment is null or not(p_fulfillment=any(app_private.product_request_fulfillments(product.description))) then raise exception 'product_fulfillment_changed' using errcode='22023';end if;
 chat:=public.hayna_get_or_create_direct_conversation(product.seller_id);
 select * into legacy from public.messages where id=p_request;
 if found then
  if legacy.sender_id<>actor or legacy.conversation_id<>chat or left(legacy.body,char_length('طلب منتج من سوق حيّنا')+1)<>'طلب منتج من سوق حيّنا'||chr(10) or position('https://appksatest.vercel.app/marketplace-item?id='||p_item::text in legacy.body)=0 then raise exception 'product_request_forbidden' using errcode='42501';end if;
 else
  message_text:=concat_ws(chr(10),'طلب منتج من سوق حيّنا','المنتج: '||product.title,'الكمية المطلوبة: '||p_quantity,'طريقة التسليم المطلوبة: '||p_fulfillment,
   case when product.price is null then 'السعر: بالاتفاق مع البائع' else 'الإجمالي التقديري: '||(product.price*p_quantity)::text||' ر.س، قبل تكلفة التسليم' end,
   case when nullif(btrim(p_note),'') is not null then 'ملاحظات: '||btrim(p_note) end,
   'https://appksatest.vercel.app/marketplace-item?id='||p_item::text,'مرجع الطلب: '||p_request::text,'إرسال الطلب لا يعني الدفع. تفاصيل الطلب وحالته في البطاقة.');
  insert into public.messages(id,conversation_id,sender_id,body) values(p_request,chat,actor,message_text);
  -- A moderation trigger may reject a row without raising; never create a request without its message.
  if not exists(select 1 from public.messages where id=p_request and sender_id=actor) then raise exception 'product_message_not_saved' using errcode='42501';end if;
 end if;
 insert into public.marketplace_product_requests(id,message_id,conversation_id,item_id,buyer_id,seller_id,item_title,unit_price,quantity,fulfillment,note)
 values(p_request,p_request,chat,p_item,actor,product.seller_id,product.title,product.price,p_quantity,p_fulfillment,btrim(p_note)) returning * into request;
 insert into public.marketplace_product_request_events(request_id,actor_id,action,version,snapshot) values(request.id,actor,'created',request.version,jsonb_build_object('quantity',request.quantity,'unit_price',request.unit_price,'fulfillment',request.fulfillment,'note',request.note,'status',request.status));
 return jsonb_build_object('conversationId',chat,'reused',false,'request',to_jsonb(request));
end $$;
revoke all on function public.hayna_create_product_request(uuid,uuid,integer,text,text,numeric) from public,anon;
grant execute on function public.hayna_create_product_request(uuid,uuid,integer,text,text,numeric) to authenticated;

create function public.hayna_update_product_request(p_request uuid,p_version integer,p_action text,p_quantity integer default null,p_note text default null,p_fulfillment text default null,p_expected_price numeric default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); request public.marketplace_product_requests; product public.marketplace_items; new_status text; product_exists boolean;
begin
 if actor is null or not public.hayna_account_is_active(actor) then raise exception 'authentication_required' using errcode='42501';end if;
 select * into request from public.marketplace_product_requests where id=p_request;
 if not found or actor not in (request.buyer_id,request.seller_id) then raise exception 'product_request_forbidden' using errcode='42501';end if;
 -- Lock the product before the request, consistently with request creation and competing acceptances.
 select * into product from public.marketplace_items where id=request.item_id for update;product_exists:=found;
 select * into request from public.marketplace_product_requests where id=p_request for update;
 if p_version is null or request.version<>p_version then raise exception 'product_request_stale' using errcode='40001';end if;
 if request.status in ('completed','rejected','cancelled') then raise exception 'product_request_closed' using errcode='22023';end if;
 if p_action<>'cancel' and not public.hayna_can_dm(actor,case when actor=request.buyer_id then request.seller_id else request.buyer_id end) then raise exception 'product_contact_restricted' using errcode='42501';end if;
 new_status:=request.status;
 if p_action='revise' then
  if actor<>request.buyer_id or request.status<>'pending' then raise exception 'product_request_forbidden' using errcode='42501';end if;
  if not product_exists or product.status<>'available' then raise exception 'product_unavailable' using errcode='22023';end if;
  if p_quantity is null or p_quantity not between 1 and 20 or p_note is null or char_length(p_note)>400 then raise exception 'invalid_product_request' using errcode='22023';end if;
  if p_expected_price is distinct from product.price then raise exception 'product_price_changed' using errcode='22023';end if;
  if p_fulfillment is null or not(p_fulfillment=any(app_private.product_request_fulfillments(product.description))) then raise exception 'product_fulfillment_changed' using errcode='22023';end if;
  request.quantity:=p_quantity;request.note:=btrim(p_note);request.fulfillment:=p_fulfillment;request.unit_price:=product.price;
 elsif p_action='accept' then
  if actor<>request.seller_id or request.status<>'pending' then raise exception 'product_request_forbidden' using errcode='42501';end if;
  if not product_exists or product.status<>'available' then raise exception 'product_unavailable' using errcode='22023';end if;
  if request.unit_price is distinct from product.price then raise exception 'product_price_changed' using errcode='22023';end if;
  update public.marketplace_items set status='reserved',updated_at=now() where id=product.id;new_status:='accepted';
 elsif p_action='ready' then
  if actor<>request.seller_id or request.status<>'accepted' then raise exception 'product_request_forbidden' using errcode='42501';end if;
  if not product_exists or product.status<>'reserved' then raise exception 'product_unavailable' using errcode='22023';end if;
  new_status:='ready';
 elsif p_action='complete' then
  if actor<>request.buyer_id or request.status<>'ready' then raise exception 'product_request_forbidden' using errcode='42501';end if;
  if not product_exists or product.status not in ('reserved','sold') then raise exception 'product_unavailable' using errcode='22023';end if;
  update public.marketplace_items set status='sold',updated_at=now() where id=product.id;new_status:='completed';
 elsif p_action='reject' then
  if actor<>request.seller_id or request.status<>'pending' then raise exception 'product_request_forbidden' using errcode='42501';end if;
  new_status:='rejected';
 elsif p_action='cancel' then
  new_status:='cancelled';
  if product_exists and request.status in ('accepted','ready') and product.status='reserved' then update public.marketplace_items set status='available',updated_at=now() where id=product.id;end if;
 else raise exception 'invalid_product_request_action' using errcode='22023';end if;
 update public.marketplace_product_requests set status=new_status,quantity=request.quantity,note=request.note,fulfillment=request.fulfillment,unit_price=request.unit_price,version=version+1,updated_at=now() where id=request.id returning * into request;
 insert into public.marketplace_product_request_events(request_id,actor_id,action,version,snapshot) values(request.id,actor,p_action,request.version,jsonb_build_object('quantity',request.quantity,'unit_price',request.unit_price,'fulfillment',request.fulfillment,'note',request.note,'status',request.status));
 return to_jsonb(request);
end $$;
revoke all on function public.hayna_update_product_request(uuid,integer,text,integer,text,text,numeric) from public,anon;
grant execute on function public.hayna_update_product_request(uuid,integer,text,integer,text,text,numeric) to authenticated;
create function app_private.product_request_stock_consistency() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare product_id uuid;
begin
 if tg_table_name='marketplace_items' then product_id:=new.id;else product_id:=new.item_id;end if;
 if exists(select 1 from public.marketplace_product_requests where item_id=product_id and status in ('accepted','ready'))
 and not exists(select 1 from public.marketplace_items where id=product_id and status='reserved') then
  raise exception 'product_reserved_by_request' using errcode='23514';
 end if;
 return null;
end $$;
revoke all on function app_private.product_request_stock_consistency() from public,anon,authenticated;
create constraint trigger product_request_stock_guard after update on public.marketplace_items deferrable initially deferred for each row execute function app_private.product_request_stock_consistency();
create constraint trigger product_request_state_stock_guard after insert or update on public.marketplace_product_requests deferrable initially deferred for each row execute function app_private.product_request_stock_consistency();
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.marketplace_product_requests;end if;end $$;
commit;
