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
