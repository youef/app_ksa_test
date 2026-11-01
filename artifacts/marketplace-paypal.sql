-- Candidate only: test on an isolated schema before deployment. No live activation.
begin;
alter table public.marketplace_orders add column if not exists paypal_quote jsonb;
alter table public.marketplace_orders add column if not exists paypal_capture_id text;
create unique index if not exists marketplace_paypal_capture_unique on public.marketplace_orders(paypal_capture_id) where paypal_capture_id is not null;
create or replace function public.hayna_paypal_ready() returns text language sql set search_path=pg_catalog as $$select 'paypal_v1'::text$$;
revoke all on function public.hayna_paypal_ready() from public,anon,authenticated;
grant execute on function public.hayna_paypal_ready() to service_role;

-- Reuse existing eligibility/pricing/atomic reservation; never accept a client price.
create or replace function public.hayna_prepare_paypal_checkout(p_request_id text,p_kind text,p_reference text,p_service_id uuid default null,p_title text default '',p_description text default '',p_note text default '') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb; o public.marketplace_orders;begin
 r:=public.hayna_prepare_marketplace_checkout(p_request_id,p_kind,p_reference,p_service_id,p_title,p_description,p_note,'moyasar');
 select * into strict o from public.marketplace_orders where id=(r->'order'->>'id')::uuid for update;
 if (r->>'created')::boolean then
  update public.marketplace_orders set gateway='paypal' where id=o.id returning * into o;
 elsif o.gateway<>'paypal' then raise exception 'checkout_gateway_conflict' using errcode='22023';end if;
 return jsonb_build_object('created',r->'created','order',to_jsonb(o)-'metadata');
end $$;
revoke all on function public.hayna_prepare_paypal_checkout(text,text,text,uuid,text,text,text) from public,anon;
grant execute on function public.hayna_prepare_paypal_checkout(text,text,text,uuid,text,text,text) to authenticated;

create or replace function public.hayna_quote_paypal(p_order uuid,p_rate_micros bigint,p_environment text,p_merchant text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare o public.marketplace_orders; cents bigint; q jsonb;begin
 select * into o from public.marketplace_orders where id=p_order for update;
 if not found or o.gateway<>'paypal' or o.status<>'pending' then raise exception 'paypal_order_unavailable';end if;
 if o.paypal_quote is not null then return o.paypal_quote;end if;
 if p_rate_micros is null or p_rate_micros not between 1 and 10000000000 or p_environment is null or p_environment not in('sandbox','live') or coalesce(length(p_merchant),0)not between 5 and 64 then raise exception 'paypal_configuration_invalid';end if;
 cents:=round(o.amount_halalas::numeric*1000000/p_rate_micros);
 if cents not between 1 and 100000000 then raise exception 'paypal_amount_out_of_range';end if;
 q:=jsonb_build_object('id',gen_random_uuid(),'currency','USD','amount_minor',cents,'source_currency','SAR','source_amount_minor',o.amount_halalas,'rate_micros',p_rate_micros,'environment',p_environment,'merchant_id',p_merchant,'expires_at',now()+interval '15 minutes');
 update public.marketplace_orders set paypal_quote=q where id=o.id;
 return q;
end $$;
revoke all on function public.hayna_quote_paypal(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.hayna_quote_paypal(uuid,bigint,text,text) to service_role;

create or replace function public.hayna_bind_paypal(p_order uuid,p_quote uuid,p_invoice text,p_url text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare o public.marketplace_orders;begin
 select * into o from public.marketplace_orders where id=p_order for update;
 if not found or o.gateway<>'paypal' or o.status<>'pending' or p_quote is null or o.paypal_quote is null or (o.paypal_quote->>'id')::uuid is distinct from p_quote
  or coalesce(p_invoice,'')!~'^[A-Z0-9]{5,64}$' or p_url is distinct from ('https://www.'||case when o.paypal_quote->>'environment'='sandbox' then 'sandbox.' else '' end||'paypal.com/checkoutnow?token='||p_invoice)
  or(o.gateway_invoice_id is null and (o.paypal_quote->>'expires_at')::timestamptz<=now())
  or(o.gateway_invoice_id is not null and o.gateway_invoice_id<>p_invoice)
  then raise exception 'paypal_binding_mismatch';end if;
 update public.marketplace_orders set gateway_invoice_id=p_invoice,checkout_url=p_url where id=o.id;
end $$;
revoke all on function public.hayna_bind_paypal(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.hayna_bind_paypal(uuid,uuid,text,text) to service_role;

-- The old ledger remains the SAR contract value; actual USD capture/FX are recorded explicitly.
create or replace function public.hayna_confirm_paypal(p_order uuid,p_invoice text,p_capture text,p_usd_cents bigint,p_merchant text,p_environment text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare o public.marketplace_orders; r jsonb;begin
 select * into o from public.marketplace_orders where id=p_order for update;
 if not found or o.gateway<>'paypal' or o.paypal_quote is null or o.gateway_invoice_id is distinct from p_invoice
  or o.paypal_quote->>'currency' is distinct from 'USD' or p_usd_cents is null or p_usd_cents<=0
  or (o.paypal_quote->>'amount_minor')::bigint is distinct from p_usd_cents
  or o.paypal_quote->>'merchant_id' is distinct from p_merchant or o.paypal_quote->>'environment' is distinct from p_environment
  or coalesce(p_capture,'')!~'^[A-Z0-9]{5,64}$' or(o.paypal_capture_id is not null and o.paypal_capture_id<>p_capture)
  then raise exception 'paypal_verified_payment_mismatch';end if;
 r:=public.hayna_confirm_marketplace_payment(o.id,'paypal',p_invoice,o.amount_halalas,'SAR',p_capture);
 update public.marketplace_orders set paypal_capture_id=p_capture where id=o.id;
 update public.marketplace_payment_transactions set gateway_payload=gateway_payload||jsonb_build_object('capture_currency','USD','capture_amount_minor',p_usd_cents,'capture_id',p_capture,'rate_micros',o.paypal_quote->'rate_micros','environment',p_environment) where order_id=o.id and gateway='paypal';
 return r;
end $$;
revoke all on function public.hayna_confirm_paypal(uuid,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.hayna_confirm_paypal(uuid,text,text,bigint,text,text) to service_role;

-- Only call after fetching the capture from PayPal and verifying a FULL refund.
create or replace function public.hayna_refund_paypal(p_order uuid,p_capture text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare o public.marketplace_orders;begin
 select * into o from public.marketplace_orders where id=p_order for update;
 if not found or o.gateway<>'paypal' or o.paypal_capture_id is distinct from p_capture or p_capture is null then raise exception 'paypal_refund_mismatch';end if;
 if o.status='refunded' then return;end if;
 if o.status<>'paid' then raise exception 'paypal_refund_requires_paid_order';end if;
 update public.marketplace_orders set status='refunded',metadata=metadata||'{"paypal_refund":"full"}'::jsonb where id=o.id;
 update public.marketplace_payment_transactions set status='refunded',gateway_payload=gateway_payload||'{"refund":"full"}'::jsonb where order_id=o.id and gateway='paypal';
 update public.marketplace_subscriptions set status='cancelled',current_period_end=least(current_period_end,now()) where id=o.subscription_id and last_payment_order_id=o.id;
 update public.marketplace_ad_campaigns set status='ended',ends_at=least(ends_at,now()) where id=o.ad_campaign_id and payment_order_id=o.id;
 update public.marketplace_service_orders set status='refunded' where id=o.service_order_id and payment_order_id=o.id;
end $$;
revoke all on function public.hayna_refund_paypal(uuid,text) from public,anon,authenticated;
grant execute on function public.hayna_refund_paypal(uuid,text) to service_role;
commit;
