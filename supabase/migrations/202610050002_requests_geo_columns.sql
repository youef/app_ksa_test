-- Geo columns for help requests so the neighbourhood map can plot them like questions.
-- The app retries without these columns if this migration has not been applied yet.

alter table public.requests
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create index if not exists requests_open_geo_idx
  on public.requests (status, created_at desc)
  where lat is not null and lng is not null;

create index if not exists questions_geo_idx
  on public.questions (created_at desc)
  where lat is not null and lng is not null;

notify pgrst, 'reload schema';