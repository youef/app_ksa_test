-- Fix service publishing permissions for authenticated users.
drop policy if exists services_insert on public.services;
drop policy if exists services_delete on public.services;
drop policy if exists "services insert own" on public.services;
drop policy if exists "services delete own" on public.services;
drop policy if exists "services update own" on public.services;
create policy "services insert own" on public.services for insert to authenticated
  with check ((select auth.uid()) = provider_id);
create policy "services update own" on public.services for update to authenticated
  using ((select auth.uid()) = provider_id)
  with check ((select auth.uid()) = provider_id);
create policy "services delete own" on public.services for delete to authenticated
  using ((select auth.uid()) = provider_id);
grant select, insert, update, delete on public.services to authenticated;
