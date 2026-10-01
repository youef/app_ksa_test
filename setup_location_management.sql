-- Admin-managed Saudi locations (additional regions, cities, districts, and coordinates).
create table if not exists public.saudi_custom_locations (
  id uuid primary key default gen_random_uuid(),
  region_name text not null check (length(btrim(region_name)) > 0),
  city_name text,
  district_name text,
  latitude double precision,
  longitude double precision,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint saudi_custom_locations_coordinate_pair check (
    num_nonnulls(latitude, longitude) in (0, 2)
    and (latitude is null or latitude between -90 and 90)
    and (longitude is null or longitude between -180 and 180)
  ),
  constraint saudi_custom_locations_hierarchy check (
    district_name is null or city_name is not null
  )
);

create unique index if not exists saudi_custom_locations_hierarchy_name_key
  on public.saudi_custom_locations (
    lower(btrim(region_name)),
    lower(btrim(coalesce(city_name, ''))),
    lower(btrim(coalesce(district_name, '')))
  );

create index if not exists saudi_custom_locations_city_lookup_idx
  on public.saudi_custom_locations (lower(btrim(region_name)), lower(btrim(coalesce(city_name, ''))));

alter table public.saudi_custom_locations enable row level security;
grant select on public.saudi_custom_locations to anon, authenticated;
grant insert on public.saudi_custom_locations to authenticated;
grant update, delete on public.saudi_custom_locations to authenticated;

drop policy if exists "Saudi custom locations are public" on public.saudi_custom_locations;
create policy "Saudi custom locations are public"
  on public.saudi_custom_locations for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage Saudi custom locations" on public.saudi_custom_locations;
create policy "Admins manage Saudi custom locations"
  on public.saudi_custom_locations for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop policy if exists "Admins update Saudi custom locations" on public.saudi_custom_locations;
create policy "Admins update Saudi custom locations"
  on public.saudi_custom_locations for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins delete Saudi custom locations" on public.saudi_custom_locations;
create policy "Admins delete Saudi custom locations"
  on public.saudi_custom_locations for delete
  to authenticated
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
