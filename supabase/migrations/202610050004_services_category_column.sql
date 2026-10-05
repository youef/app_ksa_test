-- The live services table is missing `category` (used by new-service, user profile, map pins)
alter table public.services
  add column if not exists category text;

-- Backfill from subcategory for rows created without it
update public.services
set category = coalesce(subcategory, listing_type)
where category is null;

create index if not exists services_category_idx on public.services (category);

-- Refresh PostgREST schema cache so the API sees the new column immediately
notify pgrst, 'reload schema';
