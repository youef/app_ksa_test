-- Migration: 202610070001_push_tokens_and_community_tools.sql
-- Enables Push Notifications tokens storage, Tool lending (سلفني بالحي), and Emergency neighbor alerts (تنبيه الحي العاجل)

-- =========================================================================
-- 1. Push Tokens Table
-- =========================================================================
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null default 'mobile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "Users can manage own tokens" on public.push_tokens;
create policy "Users can manage own tokens"
  on public.push_tokens for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read tokens for notifications" on public.push_tokens;
create policy "Authenticated users can read tokens for notifications"
  on public.push_tokens for select
  to authenticated
  using (true);

create index if not exists idx_push_tokens_user on public.push_tokens(user_id);

-- =========================================================================
-- 2. Tool Lending System: سلفني بالحي (Borrow & Lend)
-- =========================================================================
create table if not exists public.borrow_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'tools', -- 'tools', 'ladder', 'cleaning', 'outdoor', 'electronics', 'other'
  image_url text,
  city text not null default 'الرياض',
  district text not null default 'العليا',
  status text not null default 'available', -- 'available', 'borrowed', 'unavailable'
  max_days integer not null default 3,
  deposit_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.borrow_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.borrow_items(id) on delete cascade,
  borrower_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- 'pending', 'approved', 'rejected', 'returned'
  start_date date not null default current_date,
  duration_days integer not null default 1,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.borrow_items enable row level security;
alter table public.borrow_requests enable row level security;

-- Policies for borrow items:
drop policy if exists "Anyone can read available borrow items" on public.borrow_items;
create policy "Anyone can read available borrow items"
  on public.borrow_items for select
  to public
  using (true);

drop policy if exists "Users can manage own borrow items" on public.borrow_items;
create policy "Users can manage own borrow items"
  on public.borrow_items for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Policies for borrow requests:
drop policy if exists "Item owners and borrowers can view requests" on public.borrow_requests;
create policy "Item owners and borrowers can view requests"
  on public.borrow_requests for select
  to authenticated
  using (
    auth.uid() = borrower_id or
    auth.uid() in (select owner_id from public.borrow_items where id = item_id)
  );

drop policy if exists "Authenticated users can create borrow requests" on public.borrow_requests;
create policy "Authenticated users can create borrow requests"
  on public.borrow_requests for insert
  to authenticated
  with check (auth.uid() = borrower_id);

drop policy if exists "Owners and borrowers can update request status" on public.borrow_requests;
create policy "Owners and borrowers can update request status"
  on public.borrow_requests for update
  to authenticated
  using (
    auth.uid() = borrower_id or
    auth.uid() in (select owner_id from public.borrow_items where id = item_id)
  );

-- =========================================================================
-- 3. Urgent Neighborhood Alerts: تنبيه الحي العاجل 🚨
-- =========================================================================
create table if not exists public.urgent_alerts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  alert_type text not null default 'general', -- 'missing', 'water_leak', 'car_blocked', 'fire_hazard', 'general'
  city text not null default 'الرياض',
  district text not null default 'العليا',
  status text not null default 'active', -- 'active', 'resolved'
  location_lat double precision,
  location_lng double precision,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.urgent_alerts enable row level security;

drop policy if exists "Anyone can view active urgent alerts" on public.urgent_alerts;
create policy "Anyone can view active urgent alerts"
  on public.urgent_alerts for select
  to public
  using (true);

drop policy if exists "Authenticated users can publish urgent alerts" on public.urgent_alerts;
create policy "Authenticated users can publish urgent alerts"
  on public.urgent_alerts for insert
  to authenticated
  with check (auth.uid() = creator_id);

drop policy if exists "Alert creators can update or resolve their alerts" on public.urgent_alerts;
create policy "Alert creators can update or resolve their alerts"
  on public.urgent_alerts for update
  to authenticated
  using (auth.uid() = creator_id);

-- =========================================================================
-- 4. Neighbor Verification & Badges System: جار موثق والأوسمة
-- =========================================================================
alter table public.profiles
  add column if not exists is_verified_neighbor boolean default false,
  add column if not exists verification_method text, -- 'national_address', 'manual_code', 'gps_home'
  add column if not exists badges jsonb default '["جار جديد"]'::jsonb;

notify pgrst, 'reload schema';
