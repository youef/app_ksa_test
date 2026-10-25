
-- Consolidate duplicate marketplace/business/service policies so moderation rules are effective.

-- Businesses: approved rows are public; owners and staff can inspect their own/non-public rows.
drop policy if exists "business moderation public select" on public.businesses;
drop policy if exists "businesses readable" on public.businesses;
drop policy if exists "business admin update" on public.businesses;
drop policy if exists "businesses update own" on public.businesses;

-- Keep the single owner/admin update policy and moderation visibility policy.

-- Services: remove broad true SELECT policies that bypass moderation.
drop policy if exists "market moderation public select" on public.services;
drop policy if exists "services marketplace read" on public.services;
drop policy if exists "services_select" on public.services;

-- Remove duplicate update/delete policies; retain Providers/admin versions.
drop policy if exists "services delete own" on public.services;
drop policy if exists "market owner/admin update restriction" on public.services;
drop policy if exists "services admin update" on public.services;
drop policy if exists "services update own" on public.services;

-- Marketplace products: publishing is available to personal or merchant accounts.
drop policy if exists "marketplace insert" on public.marketplace_items;
create policy "marketplace insert eligible owner"
on public.marketplace_items
for insert
to authenticated
with check (
  seller_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or p.account_type in ('standard','merchant')
      )
  )
);

-- Products themselves are public marketplace content; owners/admins keep normal access.
drop policy if exists "marketplace select" on public.marketplace_items;
create policy "marketplace public read"
on public.marketplace_items
for select
to anon, authenticated
using (true);

-- Reviews are public reputation content.
drop policy if exists "reviews readable" on public.reviews;
create policy "reviews public read"
on public.reviews
for select
to anon, authenticated
using (true);
