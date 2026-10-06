-- Fix app_branding table and permissions
create table if not exists public.app_branding (
  id text primary key,
  logo_url text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  updated_by uuid references auth.users(id)
);

-- Enable RLS
alter table public.app_branding enable row level security;

-- Drop conflicting old policies if any
drop policy if exists "Allow public read access to app_branding" on public.app_branding;
drop policy if exists "Allow admins to modify app_branding" on public.app_branding;
drop policy if exists "Public app_branding read" on public.app_branding;
drop policy if exists "Admin app_branding write" on public.app_branding;

-- 1. Allow everyone (anon and authenticated) to read branding
create policy "Allow public read access to app_branding"
  on public.app_branding for select
  to public
  using (true);

-- 2. Allow admins to insert/update/delete branding
create policy "Allow admins to modify app_branding"
  on public.app_branding for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and (profiles.role = 'admin' or auth.jwt() ->> 'email' = 'root@gmail.com')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and (profiles.role = 'admin' or auth.jwt() ->> 'email' = 'root@gmail.com')
    )
  );

-- Ensure public storage bucket permissions for branding bucket
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

-- Seed or update default global branding row
insert into public.app_branding (id, logo_url, updated_at)
values (
  'global',
  'https://vkeuyompnddqfvulalkk.supabase.co/storage/v1/object/public/branding/global/logo.png',
  now()
)
on conflict (id) do update
set logo_url = excluded.logo_url,
    updated_at = excluded.updated_at;
