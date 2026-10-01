grant update, delete on public.saudi_custom_locations to authenticated;

drop policy if exists "Admins update Saudi custom locations" on public.saudi_custom_locations;
create policy "Admins update Saudi custom locations" on public.saudi_custom_locations for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "Admins delete Saudi custom locations" on public.saudi_custom_locations;
create policy "Admins delete Saudi custom locations" on public.saudi_custom_locations for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create table if not exists public.saudi_location_overrides (
  source_id text primary key,
  new_name text,
  is_deleted boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint saudi_location_overrides_name check (is_deleted or (new_name is not null and length(btrim(new_name)) > 0))
);
alter table public.saudi_location_overrides enable row level security;
grant select on public.saudi_location_overrides to anon, authenticated;
grant insert, update, delete on public.saudi_location_overrides to authenticated;
drop policy if exists "Saudi location overrides are public" on public.saudi_location_overrides;
create policy "Saudi location overrides are public" on public.saudi_location_overrides for select to anon, authenticated using (true);
drop policy if exists "Admins manage Saudi location overrides" on public.saudi_location_overrides;
create policy "Admins manage Saudi location overrides" on public.saudi_location_overrides for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
