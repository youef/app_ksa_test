begin;
-- Additive marketplace-only release. The broad 14-system migration is excluded.
do $marketplace_foundation$
begin
 if to_regclass('public.marketplace_plans') is null then
  execute $foundation_sql$
-- Marketplace commerce foundation: paid service orders, subscriptions, ads, and payment ledger.
-- Payment secrets stay in Supabase Edge Function secrets; never ship them to the client.

create table if not exists public.marketplace_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price_halalas bigint not null check (price_halalas >= 0),
  period_days integer not null check (period_days > 0),
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_ad_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price_halalas bigint not null check (price_halalas > 0),
  duration_days integer not null check (duration_days > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_service_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null,
  amount_halalas bigint not null check (amount_halalas > 0),
  currency text not null default 'SAR' check (currency = 'SAR'),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','accepted','in_progress','completed','cancelled','refunded','payment_failed')),
  buyer_note text,
  payment_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.marketplace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.marketplace_plans(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','active','past_due','cancelled','expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  auto_renew boolean not null default false,
  cancel_at_period_end boolean not null default false,
  last_payment_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_subscriptions_user_status_idx
  on public.marketplace_subscriptions(user_id, status, current_period_end desc);

create table if not exists public.marketplace_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  package_id uuid not null references public.marketplace_ad_packages(id) on delete restrict,
  title text not null,
  description text not null default '',
  status text not null default 'pending_payment'
    check (status in ('draft','pending_payment','pending_review','active','paused','rejected','ended','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  payment_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_ad_campaigns_status_end_idx
  on public.marketplace_ad_campaigns(status, ends_at);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_type text not null check (order_type in ('service_order','subscription','ad_campaign')),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','cancelled','refunded','expired')),
  amount_halalas bigint not null check (amount_halalas > 0),
  currency text not null default 'SAR' check (currency = 'SAR'),
  gateway text not null default 'moyasar',
  gateway_invoice_id text unique,
  checkout_url text,
  idempotency_key text not null unique,
  service_order_id uuid references public.marketplace_service_orders(id) on delete set null,
  subscription_id uuid references public.marketplace_subscriptions(id) on delete set null,
  ad_campaign_id uuid references public.marketplace_ad_campaigns(id) on delete set null,
  plan_id uuid references public.marketplace_plans(id) on delete set null,
  package_id uuid references public.marketplace_ad_packages(id) on delete set null,
  period_days integer,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_orders_user_created_idx
  on public.marketplace_orders(user_id, created_at desc);
create index if not exists marketplace_orders_status_created_idx
  on public.marketplace_orders(status, created_at desc);

create table if not exists public.marketplace_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gateway text not null,
  gateway_invoice_id text,
  amount_halalas bigint not null check (amount_halalas > 0),
  currency text not null default 'SAR' check (currency = 'SAR'),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','refunded','cancelled')),
  gateway_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gateway, gateway_invoice_id)
);

create index if not exists marketplace_payment_transactions_user_idx
  on public.marketplace_payment_transactions(user_id, created_at desc);

alter table public.marketplace_service_orders
  add constraint marketplace_service_orders_payment_order_fk
  foreign key (payment_order_id) references public.marketplace_orders(id) on delete set null;
alter table public.marketplace_subscriptions
  add constraint marketplace_subscriptions_last_payment_order_fk
  foreign key (last_payment_order_id) references public.marketplace_orders(id) on delete set null;
alter table public.marketplace_ad_campaigns
  add constraint marketplace_ad_campaigns_payment_order_fk
  foreign key (payment_order_id) references public.marketplace_orders(id) on delete set null;

alter table public.marketplace_plans enable row level security;
alter table public.marketplace_ad_packages enable row level security;
alter table public.marketplace_service_orders enable row level security;
alter table public.marketplace_subscriptions enable row level security;
alter table public.marketplace_ad_campaigns enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_payment_transactions enable row level security;

drop policy if exists "Active marketplace plans are readable" on public.marketplace_plans;
create policy "Active marketplace plans are readable"
  on public.marketplace_plans for select to anon, authenticated using (active = true);

drop policy if exists "Active marketplace ad packages are readable" on public.marketplace_ad_packages;
create policy "Active marketplace ad packages are readable"
  on public.marketplace_ad_packages for select to anon, authenticated using (active = true);

drop policy if exists "Buyers and providers can read service orders" on public.marketplace_service_orders;
create policy "Buyers and providers can read service orders"
  on public.marketplace_service_orders for select to authenticated
  using (buyer_id = (select auth.uid()) or provider_id = (select auth.uid()));

drop policy if exists "Users can read their subscriptions" on public.marketplace_subscriptions;
create policy "Users can read their subscriptions"
  on public.marketplace_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owners can read their ad campaigns" on public.marketplace_ad_campaigns;
create policy "Owners can read their ad campaigns"
  on public.marketplace_ad_campaigns for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Users can read their marketplace orders" on public.marketplace_orders;
create policy "Users can read their marketplace orders"
  on public.marketplace_orders for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can read their payment transactions" on public.marketplace_payment_transactions;
create policy "Users can read their payment transactions"
  on public.marketplace_payment_transactions for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.marketplace_plans, public.marketplace_ad_packages to anon, authenticated;
grant select on public.marketplace_service_orders, public.marketplace_subscriptions,
  public.marketplace_ad_campaigns, public.marketplace_orders,
  public.marketplace_payment_transactions to authenticated;

insert into public.marketplace_plans (slug, name, description, price_halalas, period_days, features, sort_order)
values
  ('starter', 'أساسي', 'للتجربة والتواجد في سوق الحي', 0, 30, '["ملف مقدم خدمة","إدارة عروضك"]'::jsonb, 1),
  ('pro-monthly', 'احترافي شهري', 'ظهور مميز وأدوات نمو لنشاطك', 4900, 30, '["شارة احترافي","إحصاءات النشاط","أدوات ترويج"]'::jsonb, 2),
  ('business-yearly', 'أعمال سنوي', 'خطة سنوية للمتاجر ومقدمي الخدمات', 49900, 365, '["شارة احترافي","إحصاءات النشاط","أدوات ترويج","أولوية دعم"]'::jsonb, 3)
on conflict (slug) do nothing;

insert into public.marketplace_ad_packages (slug, name, description, price_halalas, duration_days, sort_order)
values
  ('boost-7', 'ترويج 7 أيام', 'إبراز العرض لمدة أسبوع بعد موافقة الإدارة', 4900, 7, 1),
  ('boost-14', 'ترويج 14 يومًا', 'إبراز العرض لمدة أسبوعين بعد موافقة الإدارة', 8900, 14, 2),
  ('boost-30', 'ترويج 30 يومًا', 'إبراز العرض لمدة شهر بعد موافقة الإدارة', 14900, 30, 3)
on conflict (slug) do nothing;

comment on table public.marketplace_orders is 'Server-created checkout orders; only verified gateway callbacks may mark these paid.';
comment on table public.marketplace_payment_transactions is 'Append-oriented payment ledger; gateway payloads are server-managed.';


$foundation_sql$;
 end if;
end $marketplace_foundation$;
-- Standalone additive workspace. Existing application RLS/functions are untouched.
create schema if not exists app_private;
create or replace function app_private.marketplace_staff(p_user uuid)returns boolean
language sql stable security definer set search_path=pg_catalog as $$
select coalesce(exists(select 1 from public.profiles p where p.id=p_user and not coalesce(p.is_banned,false))
 and not exists(select 1 from public.admin_permissions where admin_id=p_user and permission='market' and not enabled)
 and (exists(select 1 from public.admin_permissions where admin_id=p_user and permission='market' and enabled)
 or exists(select 1 from public.admin_role_assignments a join public.admin_roles r on r.key=a.role_key where a.user_id=p_user and (r.permissions->>'all'='true' or r.permissions->>'market'='true'))),false);
$$;
revoke all on function app_private.marketplace_staff(uuid)from public,anon,authenticated;
create or replace function public.hayna_marketplace_can_review()returns boolean
language sql stable security definer set search_path=pg_catalog as $$select app_private.marketplace_staff(auth.uid())$$;
revoke all on function public.hayna_marketplace_can_review()from public,anon;
grant execute on function public.hayna_marketplace_can_review()to authenticated;
create or replace function app_private.marketplace_text_allowed(p_text text)returns boolean
language sql stable security definer set search_path=pg_catalog as $$
select not exists(select 1 from public.banned_words where enabled and length(trim(word))>=2 and
 position(' '||trim(regexp_replace(translate(lower(word),'أإآٱىةؤئ','اااايهوي'),'[^[:alnum:]_]+',' ','g'))||' ' in
 ' '||trim(regexp_replace(translate(lower(coalesce(p_text,'')),'أإآٱىةؤئ','اااايهوي'),'[^[:alnum:]_]+',' ','g'))||' ')>0);
$$;
revoke all on function app_private.marketplace_text_allowed(text)from public,anon,authenticated;
-- Existing commerce foundation must precede this migration. No payment is simulated.
revoke all on public.marketplace_orders,public.marketplace_payment_transactions,public.marketplace_service_orders,public.marketplace_subscriptions,public.marketplace_ad_campaigns from anon,authenticated;
grant select on public.marketplace_orders,public.marketplace_payment_transactions,public.marketplace_service_orders,public.marketplace_subscriptions,public.marketplace_ad_campaigns to authenticated;
revoke truncate,references,trigger,insert,update,delete on public.marketplace_plans,public.marketplace_ad_packages from anon,authenticated;
grant all on public.marketplace_orders,public.marketplace_payment_transactions,public.marketplace_service_orders,public.marketplace_subscriptions,public.marketplace_ad_campaigns,public.marketplace_plans,public.marketplace_ad_packages to service_role;

create or replace function app_private.marketplace_professional(p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
select exists(select 1 from public.profiles p where p.id=p_user and not coalesce(p.is_banned,false)
 and ((p.is_verified and (p.account_type in ('freelance','provider') or (p.account_type='merchant' and p.is_verified_merchant)))
 or app_private.marketplace_staff(p_user)));
$$;
revoke all on function app_private.marketplace_professional(uuid) from public,anon,authenticated;

create or replace function public.hayna_marketplace_workspace(p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); result jsonb;begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and not coalesce(is_banned,false)) then raise exception 'authentication_required' using errcode='42501';end if;
 select jsonb_build_object(
 'professional',app_private.marketplace_professional(uid),'admin',app_private.marketplace_staff(auth.uid()),
 'location',(select jsonb_build_object('city',city,'district',district) from public.profiles where id=uid),
 'plans',(select coalesce(jsonb_agg(to_jsonb(p) order by sort_order),'[]') from public.marketplace_plans p where active),
 'packages',(select coalesce(jsonb_agg(to_jsonb(p) order by sort_order),'[]') from public.marketplace_ad_packages p where active),
 'subscription',(select jsonb_build_object('id',s.id,'status',s.status,'plan_id',s.plan_id,'name',p.name,'price_halalas',p.price_halalas,'current_period_end',s.current_period_end,'cancel_at_period_end',s.cancel_at_period_end) from public.marketplace_subscriptions s join public.marketplace_plans p on p.id=s.plan_id where s.user_id=uid and s.status='active' and s.current_period_end>now() order by p.price_halalas desc,s.current_period_end desc limit 1),
 'services',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select id,name,moderation_status from public.services where provider_id=uid order by created_at desc limit 50)s),
 'campaigns',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (select id,title,description,service_id,status,starts_at,ends_at,created_at from public.marketplace_ad_campaigns where owner_id=uid order by created_at desc limit 50)c),
 'orders',(select coalesce(jsonb_agg(to_jsonb(o)),'[]') from (select id,order_type,status,amount_halalas,currency,created_at,checkout_url,paid_at from public.marketplace_orders where user_id=uid and(p_before is null or created_at<p_before) order by created_at desc,id desc limit 21)o),
 'service_orders',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select id,service_name,status,amount_halalas,created_at,completed_at,buyer_id=uid as is_buyer,provider_id=uid as is_provider from public.marketplace_service_orders where buyer_id=uid or provider_id=uid order by created_at desc,id desc limit 50)s),
 'stats',jsonb_build_object('products',(select count(*) from public.marketplace_items where seller_id=uid and status='available'),'services',(select count(*) from public.services where provider_id=uid and moderation_status='approved'),'active_campaigns',(select count(*) from public.marketplace_ad_campaigns where owner_id=uid and status='active' and ends_at>now()),'pending_services',(select count(*) from public.marketplace_service_orders where provider_id=uid and status in ('paid','accepted','in_progress')),'confirmed_spend_halalas',(select coalesce(sum(amount_halalas),0) from public.marketplace_orders where user_id=uid and status='paid'))
 ) into result;return result;
end $$;
revoke all on function public.hayna_marketplace_workspace(timestamptz) from public,anon;
grant execute on function public.hayna_marketplace_workspace(timestamptz) to authenticated;

create or replace function public.hayna_activate_free_marketplace_plan() returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); plan public.marketplace_plans; existing uuid;begin
 if not app_private.marketplace_professional(uid) then raise exception 'verified_market_account_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,923104));
 select id into existing from public.marketplace_subscriptions where user_id=uid and status='active' and current_period_end>now() order by current_period_end desc limit 1;
 if existing is not null then return existing;end if;
 select * into plan from public.marketplace_plans where slug='starter' and active and price_halalas=0;
 if not found then raise exception 'free_plan_unavailable' using errcode='22023';end if;
 insert into public.marketplace_subscriptions(user_id,plan_id,status,current_period_start,current_period_end)values(uid,plan.id,'active',now(),now()+make_interval(days=>plan.period_days)) returning id into existing;
 return existing;
end $$;
revoke all on function public.hayna_activate_free_marketplace_plan() from public,anon;
grant execute on function public.hayna_activate_free_marketplace_plan() to authenticated;

create or replace function public.hayna_manage_marketplace(p_kind text,p_id uuid,p_action text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); campaign public.marketplace_ad_campaigns; service_order public.marketplace_service_orders;begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and not coalesce(is_banned,false))then raise exception 'authentication_required' using errcode='42501';end if;
 if p_kind='campaign' then
  select * into campaign from public.marketplace_ad_campaigns where id=p_id and owner_id=uid for update;
  if not found then raise exception 'permission_denied' using errcode='42501';end if;
  if p_action='pause' and campaign.status='active' then update public.marketplace_ad_campaigns set status='paused',updated_at=now() where id=p_id;
  elsif p_action='resume' and campaign.status='paused' and campaign.ends_at>now() and app_private.marketplace_professional(uid) then update public.marketplace_ad_campaigns set status='active',updated_at=now() where id=p_id;
  else raise exception 'invalid_transition' using errcode='22023';end if;
 elsif p_kind='subscription' and p_action='cancel_renewal' then
  update public.marketplace_subscriptions set cancel_at_period_end=true,auto_renew=false,updated_at=now() where id=p_id and user_id=uid and status='active';
  if not found then raise exception 'permission_denied' using errcode='42501';end if;
 elsif p_kind='service_order' then
  select * into service_order from public.marketplace_service_orders where id=p_id and (provider_id=uid or buyer_id=uid) for update;
  if not found then raise exception 'permission_denied' using errcode='42501';end if;
  if p_action='accept' and service_order.provider_id=uid and service_order.status='paid' then update public.marketplace_service_orders set status='accepted',updated_at=now() where id=p_id;
  elsif p_action='start' and service_order.provider_id=uid and service_order.status='accepted' then update public.marketplace_service_orders set status='in_progress',updated_at=now() where id=p_id;
  elsif p_action='complete' and service_order.buyer_id=uid and service_order.status='in_progress' then update public.marketplace_service_orders set status='completed',completed_at=now(),updated_at=now() where id=p_id;
  elsif p_action='complete' and service_order.buyer_id=uid and service_order.status='completed' then return;
  else raise exception 'invalid_transition' using errcode='22023';end if;
 else raise exception 'invalid_action' using errcode='22023';end if;
end $$;
revoke all on function public.hayna_manage_marketplace(text,uuid,text) from public,anon;
grant execute on function public.hayna_manage_marketplace(text,uuid,text) to authenticated;

-- The webhook verifies the remote provider first, then commits all local effects atomically.
create or replace function public.hayna_confirm_marketplace_payment(p_order uuid,p_gateway text,p_invoice text,p_amount bigint,p_currency text,p_payment text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare o public.marketplace_orders; target_user uuid;begin
 select * into o from public.marketplace_orders where id=p_order for update;
 if not found or p_gateway is distinct from o.gateway or p_amount is distinct from o.amount_halalas or p_currency is distinct from 'SAR' or nullif(p_invoice,'') is null
  or(o.gateway_invoice_id is not null and o.gateway_invoice_id<>p_invoice)then raise exception 'verified_payment_mismatch' using errcode='22023';end if;
 if o.status='refunded' then raise exception 'refunded_order_cannot_reactivate' using errcode='22023';end if;
 if o.status='paid' then return jsonb_build_object('paid',true,'duplicate',true);end if;
 if o.order_type='subscription' then
  perform pg_advisory_xact_lock(hashtextextended(o.user_id::text,923104));
  update public.marketplace_subscriptions set status='expired',updated_at=now() where user_id=o.user_id and status='active';
  update public.marketplace_subscriptions set status='active',current_period_start=now(),current_period_end=now()+make_interval(days=>greatest(1,coalesce(o.period_days,30))),auto_renew=false,cancel_at_period_end=false,last_payment_order_id=o.id,updated_at=now() where id=o.subscription_id and user_id=o.user_id;
  if not found then raise exception 'subscription_missing';end if;
 elsif o.order_type='ad_campaign' then
  update public.marketplace_ad_campaigns set status='pending_review',payment_order_id=o.id,updated_at=now() where id=o.ad_campaign_id and owner_id=o.user_id;
  if not found then raise exception 'campaign_missing';end if;
 elsif o.order_type='service_order' then
  update public.marketplace_service_orders set status='paid',payment_order_id=o.id,updated_at=now() where id=o.service_order_id and buyer_id=o.user_id;
  if not found then raise exception 'service_order_missing';end if;
 end if;
 update public.marketplace_orders set status='paid',paid_at=now(),gateway_invoice_id=p_invoice,updated_at=now(),metadata=metadata||jsonb_build_object('verified_gateway_status','paid','gateway_payment_id',p_payment) where id=o.id;
 insert into public.marketplace_payment_transactions(order_id,user_id,gateway,gateway_invoice_id,amount_halalas,currency,status,paid_at,gateway_payload)
 values(o.id,o.user_id,p_gateway,p_invoice,p_amount,'SAR','paid',now(),jsonb_build_object('verified',true,'payment_id',p_payment))
 on conflict(gateway,gateway_invoice_id)do update set status='paid',paid_at=excluded.paid_at,updated_at=now();
 return jsonb_build_object('paid',true,'duplicate',false);
end $$;
revoke all on function public.hayna_confirm_marketplace_payment(uuid,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.hayna_confirm_marketplace_payment(uuid,text,text,bigint,text,text) to service_role;

create or replace function public.hayna_review_marketplace_campaign(p_campaign uuid,p_approve boolean) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare campaign public.marketplace_ad_campaigns; days integer;begin
 if not app_private.marketplace_staff(auth.uid()) then raise exception 'permission_denied:market' using errcode='42501';end if;
 select * into campaign from public.marketplace_ad_campaigns where id=p_campaign for update;
 if not found or campaign.status<>'pending_review' then raise exception 'campaign_already_reviewed' using errcode='22023';end if;
 if not exists(select 1 from public.marketplace_orders where id=campaign.payment_order_id and status='paid' and ad_campaign_id=campaign.id and user_id=campaign.owner_id) then raise exception 'confirmed_payment_required' using errcode='42501';end if;
 if p_approve is null then raise exception 'invalid_decision';end if;
 select duration_days into days from public.marketplace_ad_packages where id=campaign.package_id;
 update public.marketplace_ad_campaigns set status=case when p_approve then 'active' else 'rejected' end,starts_at=case when p_approve then now() else null end,ends_at=case when p_approve then now()+make_interval(days=>days)else null end,updated_at=now()where id=campaign.id;
 insert into public.admin_activity_logs(actor_id,action,target_type,target_id,metadata)values(auth.uid(),'marketplace_campaign_review','campaign',campaign.id,jsonb_build_object('approved',p_approve));
end $$;
revoke all on function public.hayna_review_marketplace_campaign(uuid,boolean) from public,anon;
grant execute on function public.hayna_review_marketplace_campaign(uuid,boolean) to authenticated;

create or replace function public.hayna_marketplace_promotions(p_city text,p_district text default null) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
select coalesce(jsonb_agg(to_jsonb(c)),'[]')from(select c.id,c.title,c.description,c.service_id,c.ends_at from public.marketplace_ad_campaigns c
 join public.profiles p on p.id=c.owner_id join public.marketplace_orders o on o.id=c.payment_order_id and o.status='paid'
 where c.status='active' and c.starts_at<=now() and c.ends_at>now() and p.city=p_city and(p_district is null or p.district=p_district)
 and app_private.marketplace_professional(p.id) order by c.starts_at desc,c.id limit 3)c;
$$;
revoke all on function public.hayna_marketplace_promotions(text,text) from public;
grant execute on function public.hayna_marketplace_promotions(text,text) to anon,authenticated;

-- Atomic checkout reservation; the browser never supplies price or payment status.
create or replace function public.hayna_prepare_marketplace_checkout(p_request_id text,p_kind text,p_reference text,p_service_id uuid default null,p_title text default '',p_description text default '',p_note text default '',p_gateway text default 'moyasar') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); prior public.marketplace_orders; plan public.marketplace_plans; package public.marketplace_ad_packages; service public.services; price bigint; duration integer; child uuid; result public.marketplace_orders;begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and not coalesce(is_banned,false))then raise exception 'authentication_required' using errcode='42501';end if;
 if p_request_id is null or length(p_request_id)not between 8 and 100 or p_gateway not in('moyasar','tap')then raise exception 'invalid_checkout_request' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_id,201501));
 select * into prior from public.marketplace_orders where idempotency_key=uid::text||':'||p_request_id;
 if found then return jsonb_build_object('created',false,'order',to_jsonb(prior)-'metadata');end if;
 if p_kind in('subscription','ad_campaign') and not app_private.marketplace_professional(uid)then raise exception 'verified_market_account_required' using errcode='42501';end if;
 if p_kind='subscription' then
  select * into plan from public.marketplace_plans where slug=p_reference and active and price_halalas>0;
  if not found then raise exception 'plan_unavailable' using errcode='22023';end if;
  if exists(select 1 from public.marketplace_subscriptions s join public.marketplace_plans p on p.id=s.plan_id where s.user_id=uid and s.status='active' and s.current_period_end>now() and p.price_halalas>0)then raise exception 'paid_plan_already_active' using errcode='22023';end if;
  price:=plan.price_halalas;duration:=plan.period_days;
  insert into public.marketplace_subscriptions(user_id,plan_id)values(uid,plan.id)returning id into child;
 elsif p_kind='ad_campaign' then
  select * into package from public.marketplace_ad_packages where slug=p_reference and active;
  if not found or length(trim(p_title))not between 3 and 100 or length(p_description)>1000 then raise exception 'invalid_campaign' using errcode='22023';end if;
  if not app_private.marketplace_text_allowed(p_title||' '||p_description)then raise exception 'content_not_allowed' using errcode='22023';end if;
  if p_service_id is not null and not exists(select 1 from public.services where id=p_service_id and provider_id=uid and moderation_status='approved')then raise exception 'own_approved_service_required' using errcode='42501';end if;
  price:=package.price_halalas;duration:=package.duration_days;
  insert into public.marketplace_ad_campaigns(owner_id,service_id,package_id,title,description)values(uid,p_service_id,package.id,trim(p_title),trim(p_description))returning id into child;
 elsif p_kind='service_order' then
  select * into service from public.services where id=p_service_id and moderation_status='approved' and available_now is not false;
  if not found or service.provider_id=uid or not app_private.marketplace_professional(service.provider_id)or service.price_type is distinct from 'fixed' or service.price_from is null or service.price_from<=0 then raise exception 'service_unavailable' using errcode='22023';end if;
  price:=round(service.price_from*100);
  insert into public.marketplace_service_orders(buyer_id,provider_id,service_id,service_name,amount_halalas,buyer_note)values(uid,service.provider_id,service.id,service.name,price,left(p_note,1000))returning id into child;
 else raise exception 'invalid_order_kind' using errcode='22023';end if;
 insert into public.marketplace_orders(user_id,order_type,amount_halalas,idempotency_key,gateway,service_order_id,subscription_id,ad_campaign_id,plan_id,package_id,period_days)
 values(uid,p_kind,price,uid::text||':'||p_request_id,p_gateway,case when p_kind='service_order'then child end,case when p_kind='subscription'then child end,case when p_kind='ad_campaign'then child end,plan.id,package.id,duration)returning * into result;
 if p_kind='service_order'then update public.marketplace_service_orders set payment_order_id=result.id where id=child;
 elsif p_kind='subscription'then update public.marketplace_subscriptions set last_payment_order_id=result.id where id=child;
 else update public.marketplace_ad_campaigns set payment_order_id=result.id where id=child;end if;
 return jsonb_build_object('created',true,'order',to_jsonb(result)-'metadata');
end $$;
revoke all on function public.hayna_prepare_marketplace_checkout(text,text,text,uuid,text,text,text,text)from public,anon;
grant execute on function public.hayna_prepare_marketplace_checkout(text,text,text,uuid,text,text,text,text)to authenticated;


commit;
