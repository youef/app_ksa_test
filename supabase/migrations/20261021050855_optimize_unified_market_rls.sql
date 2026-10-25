
drop policy if exists "business verified merchant insert" on public.businesses;
create policy "business verified merchant insert"
on public.businesses
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.role = 'admin' or (p.is_verified and p.account_type = 'merchant'))
  )
);

drop policy if exists "business verified owner or staff update" on public.businesses;
create policy "business verified owner or staff update"
on public.businesses
for update
to authenticated
using (
  public.hayna_is_staff((select auth.uid()))
  or (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_verified
        and p.account_type = 'merchant'
    )
  )
)
with check (
  public.hayna_is_staff((select auth.uid()))
  or (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_verified
        and p.account_type = 'merchant'
    )
  )
);

drop policy if exists "Providers and admins can delete services" on public.services;
create policy "Providers and admins can delete services"
on public.services
for delete
to authenticated
using (
  provider_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

drop policy if exists "services insert professional own" on public.services;
create policy "services insert professional own"
on public.services
for insert
to authenticated
with check (
  provider_id = (select auth.uid())
  and is_verified = false
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role = 'admin'
        or (p.is_verified and p.account_type in ('merchant','freelance','provider'))
      )
  )
);

drop policy if exists "professional provider or staff update services" on public.services;
create policy "professional provider or staff update services"
on public.services
for update
to authenticated
using (
  public.hayna_is_staff((select auth.uid()))
  or (
    provider_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_verified
        and p.account_type in ('merchant','freelance','provider')
    )
  )
)
with check (
  public.hayna_is_staff((select auth.uid()))
  or (
    provider_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_verified
        and p.account_type in ('merchant','freelance','provider')
    )
  )
);

drop policy if exists "marketplace insert eligible owner" on public.marketplace_items;
create policy "marketplace insert eligible owner"
on public.marketplace_items
for insert
to authenticated
with check (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.role = 'admin' or p.account_type in ('standard','merchant'))
  )
);

create index if not exists marketplace_items_seller_id_idx
  on public.marketplace_items(seller_id);
