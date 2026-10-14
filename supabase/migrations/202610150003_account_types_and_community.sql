-- Community hub and account types: safety center, favorites, ratings,
-- supported merchants & freelancers, and contact tickets.

-- 1) User account type and merchant/freelancer verification
alter table public.profiles
  add column if not exists account_type text not null default 'standard',
  add column if not exists freelance_trade text,
  add column if not exists is_verified_merchant boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'profiles_account_type_check') then
    alter table public.profiles add constraint profiles_account_type_check check (
      account_type in ('standard', 'merchant', 'freelance', 'provider', 'idea')
    );
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'profiles_merchant_verification_consistency') then
    alter table public.profiles add constraint profiles_merchant_verification_consistency check (
      not (account_type in ('merchant', 'freelance') and is_verified_merchant is false) or true
    );
  end if;
end
$$;

-- Extend verification requests to handle freelancers / business documents
alter table public.verification_requests
  add column if not exists verification_type text not null default 'identity',
  add column if not exists subject text,
  add column if not exists attachment_url text;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'verification_requests_type_check') then
    alter table public.verification_requests
      add constraint verification_requests_type_check check (
        verification_type in ('identity', 'freelance', 'business')
      );
  end if;
end
$$;

-- 2) Favorites (wishlist) for marketplace items, services, posts
create table if not exists public.favorite_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('service', 'product', 'request', 'store', 'post')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index if not exists favorite_items_user_idx on public.favorite_items (user_id, created_at desc);

alter table public.favorite_items enable row level security;
grant select, insert, delete on public.favorite_items to authenticated;

drop policy if exists favorites_self_all on public.favorite_items;
create policy favorites_self_all on public.favorite_items
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3) In-app support tickets that reach platform admins
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 3 and 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','closed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;
grant insert on public.support_tickets to authenticated, anon;
grant select on public.support_tickets to authenticated;

-- Anyone authenticated or a guest can open a ticket
drop policy if exists tickets_create_all on public.support_tickets;
create policy tickets_create_all on public.support_tickets
  for insert to anon, authenticated with check true;

-- Owners read their own tickets; platform admins/governance read all
drop policy if exists tickets_read_own on public.support_tickets;
create policy tickets_read_own on public.support_tickets
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- Admins can resolve tickets
drop policy if exists tickets_admin_update on public.support_tickets;
create policy tickets_admin_update on public.support_tickets
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

-- 4) App rating / value your experience
create table if not exists public.app_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1000),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id)
);
create index if not exists app_reviews_created_idx on public.app_reviews (created_at desc);

alter table public.app_reviews enable row level security;
grant insert, update, select on public.app_reviews to authenticated;

drop policy if exists reviews_create_self on public.app_reviews;
create policy reviews_create_self on public.app_reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists reviews_upsert_self on public.app_reviews;
create policy reviews_upsert_self on public.app_reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists reviews_read_public on public.app_reviews;
create policy reviews_read_public on public.app_reviews
  for select to authenticated using (published = true);

-- 5) Follow list helper (rename-safe wrapper over existing follows table)
-- Profiles expose follower/following through this view
create or replace view public.user_follow_stats as
  select p.id,
    (select count(*) from public.follows f where f.follower_id = p.id) as following_count,
    (select count(*) from public.follows f where f.following_id = p.id) as followers_count
  from public.profiles p;

grant select on public.user_follow_stats to authenticated;

-- 6) Ensure admin role stays adequate (already default 'user')
update public.profiles set role = 'user' where role is null;
