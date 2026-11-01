
-- Add seller-updated delivery details, buyer notifications, product revisions and ticket status alerts.
alter table public.marketplace_service_orders add column if not exists scheduled_delivery_at timestamptz;
alter table public.marketplace_service_orders add column if not exists delivery_note text not null default '';
alter table public.marketplace_service_orders drop constraint if exists marketplace_service_orders_delivery_note_length;
alter table public.marketplace_service_orders add constraint marketplace_service_orders_delivery_note_length check(char_length(delivery_note)<=500);
create or replace function public.hayna_order_update_delivery(p_order uuid,p_delivery_at timestamptz,p_note text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or p_note is null or char_length(p_note)>500 or (p_delivery_at is not null and p_delivery_at<now())
 then raise exception 'invalid_delivery_update' using errcode='22023';end if;
 update public.marketplace_service_orders set scheduled_delivery_at=p_delivery_at,delivery_note=btrim(p_note),updated_at=now()
 where id=p_order and provider_id=auth.uid() and status in ('accepted','in_progress')
 and exists(select 1 from public.profiles where id=auth.uid() and not coalesce(is_banned,false));
 if not found then raise exception 'permission_denied_or_closed' using errcode='42501';end if;
end $$;
revoke all on function public.hayna_order_update_delivery(uuid,timestamptz,text) from public,anon;
grant execute on function public.hayna_order_update_delivery(uuid,timestamptz,text) to authenticated;

create or replace function app_private.hayna_delivery_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.scheduled_delivery_at is distinct from old.scheduled_delivery_at or new.delivery_note is distinct from old.delivery_note then
  perform app_private.hayna_order_emit_notification(new.buyer_id,'order_details',new.id,'تحديث تفاصيل الطلب','عدّل البائع موعد التسليم أو تفاصيل التجهيز',
   'delivery:'||new.id::text||':'||new.updated_at::text);
  insert into public.order_status_history(service_order_id,actor_id,old_status,new_status,note)
  values(new.id,auth.uid(),old.status,new.status,'تم تحديث موعد التسليم أو تفاصيله');
 end if;
 return new;
end $$;
revoke all on function app_private.hayna_delivery_changed() from public,anon,authenticated;
create trigger hayna_service_delivery_changed after update of scheduled_delivery_at,delivery_note on public.marketplace_service_orders
for each row execute function app_private.hayna_delivery_changed();

create or replace function app_private.hayna_product_request_revise_notify() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare v_seller uuid;begin
 if new.action='revise' then
  select seller_id into v_seller from public.marketplace_product_requests where id=new.request_id;
  perform app_private.hayna_order_emit_notification(v_seller,'order_details',new.request_id,'تعديل طلب منتج','عدّل المشتري تفاصيل طلب المنتج','product_rev:'||new.request_id::text||':'||new.version::text);
 end if;
 return new;
end $$;
revoke all on function app_private.hayna_product_request_revise_notify() from public,anon,authenticated;
create trigger hayna_product_revise_notify after insert on public.marketplace_product_request_events
for each row execute function app_private.hayna_product_request_revise_notify();

create or replace function app_private.hayna_dispute_status_notify() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if old.status is distinct from new.status then
  perform app_private.hayna_order_emit_notification(new.requester_id,'dispute_status',new.id,'تحديث حالة بلاغك','تغيرت حالة تذكرتك إلى '||new.status,'dispute_status:'||new.id::text||':'||new.status||':'||new.updated_at::text);
 end if;return new;
end $$;
revoke all on function app_private.hayna_dispute_status_notify() from public,anon,authenticated;
create trigger hayna_dispute_status_notify after update of status on public.order_disputes
for each row execute function app_private.hayna_dispute_status_notify();

-- Route order-only pushes through Expo once, and honour each user's push preference.
drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push after insert on public.notifications for each row
 when(new.type not in ('order_status','order_details','dispute_reply','dispute_status','review_reply'))
 execute function public.dispatch_push_notification();
drop trigger if exists notifications_push_after_insert on public.notifications;
create trigger notifications_push_after_insert after insert on public.notifications for each row
 when(new.type not in ('order_status','order_details','dispute_reply','dispute_status','review_reply') or (new.data->>'push_allowed')='true')
 execute function public.send_notification_push();

-- Prevent updates to a review's identity, rating, receipt, and original content.
create or replace function app_private.hayna_guard_review_moderation() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.service_order_id is distinct from old.service_order_id
 or new.product_request_id is distinct from old.product_request_id or new.buyer_id is distinct from old.buyer_id
 or new.seller_id is distinct from old.seller_id or new.rating is distinct from old.rating
 or new.body is distinct from old.body or new.photo_paths is distinct from old.photo_paths
 or new.created_at is distinct from old.created_at then
  raise exception 'review_content_immutable' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function app_private.hayna_guard_review_moderation() from public,anon,authenticated;
create trigger hayna_guard_review_moderation before update on public.order_reviews for each row
execute function app_private.hayna_guard_review_moderation();
