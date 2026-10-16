alter table public.requests
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_at timestamptz;
alter table public.questions
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_at timestamptz;
create index if not exists requests_featured_feed_idx on public.requests (is_featured desc, featured_at desc nulls last);
create index if not exists questions_featured_feed_idx on public.questions (is_featured desc, featured_at desc nulls last);
