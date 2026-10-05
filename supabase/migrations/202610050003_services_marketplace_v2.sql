-- Marketplace v2: listing types, images, delivery modes and type-specific details
alter table public.services
  add column if not exists listing_type text,
  add column if not exists subcategory text,
  add column if not exists images text[] not null default '{}',
  add column if not exists cover_url text,
  add column if not exists delivery_modes text[] not null default '{}',
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists shop_name text,
  add column if not exists working_hours text,
  add column if not exists whatsapp text,
  add column if not exists price_type text not null default 'fixed';

create index if not exists services_listing_type_idx on public.services (listing_type);
create index if not exists services_created_at_idx on public.services (created_at desc);

-- Storage bucket for service images (public read, owner-folder write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images', 'service-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = true;

drop policy if exists "service images public read" on storage.objects;
create policy "service images public read" on storage.objects
  for select using (bucket_id = 'service-images');

drop policy if exists "service images owner insert" on storage.objects;
create policy "service images owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'service-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "service images owner update" on storage.objects;
create policy "service images owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'service-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "service images owner delete" on storage.objects;
create policy "service images owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'service-images' and (storage.foldername(name))[1] = auth.uid()::text);
